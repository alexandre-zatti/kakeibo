"use server";

import { revalidatePath } from "next/cache";
import { resolveSessionAndHousehold, type ActionResult } from "@/actions/_helpers";
import { getAdapters } from "@/services/adapter";
import { createAdapterRun, getRunLogById, updateRunLogStatus } from "@/services/adapter-run";
import { executeAdapterRun } from "@/adapters/runner";
import { getAdapterModule } from "@/adapters/modules";
import { createExpense } from "@/services/expense";
import { saveAttachment } from "@/adapters/file-storage";
import { AdapterRunLogStatus, ExpenseSource } from "@/types/finances";
import logger, { serializeError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import type { AdapterRunWithLogs } from "@/types/finances";

const log = logger.child({ module: "actions/adapter-run" });

export async function triggerAdapterRunAction(
  budgetId: number
): Promise<ActionResult<{ runId: number }>> {
  try {
    const ctx = await resolveSessionAndHousehold();
    if ("error" in ctx) return { success: false, error: ctx.error };

    // Verify budget exists and belongs to household
    const budget = await prisma.monthlyBudget.findFirst({
      where: { id: budgetId, householdId: ctx.householdId },
    });

    if (!budget) return { success: false, error: "Orçamento não encontrado" };

    // Get active adapters
    const adapters = await getAdapters(ctx.householdId);
    const activeAdapters = adapters.filter((a) => a.isActive);

    if (activeAdapters.length === 0) {
      return { success: false, error: "Nenhum adaptador ativo configurado" };
    }

    // Create the run with pending logs
    const run = await createAdapterRun(
      ctx.householdId,
      budgetId,
      activeAdapters.map((a) => a.id)
    );

    // Fire and forget — run adapters asynchronously
    executeAdapterRun(run, budgetId, ctx.householdId, budget.year, budget.month).then(() => {
      revalidatePath("/finances");
      revalidatePath("/finances/adapters");
    });

    revalidatePath("/finances/adapters");
    return { success: true, data: { runId: run.id } };
  } catch (error) {
    log.error({ error: serializeError(error) }, "Failed to trigger adapter run");
    return { success: false, error: "Erro ao iniciar execução dos adaptadores" };
  }
}

export async function retryAdapterLogAction(logId: number): Promise<ActionResult> {
  try {
    const ctx = await resolveSessionAndHousehold();
    if ("error" in ctx) return { success: false, error: ctx.error };

    const runLog = await getRunLogById(logId, ctx.householdId);
    if (!runLog) return { success: false, error: "Log não encontrado" };

    if (runLog.status !== AdapterRunLogStatus.ERROR) {
      return { success: false, error: "Apenas adaptadores com erro podem ser reexecutados" };
    }

    const adapterModule = getAdapterModule(runLog.adapter.moduleKey);
    if (!adapterModule) {
      return { success: false, error: `Módulo "${runLog.adapter.moduleKey}" não encontrado` };
    }

    // Get the run to find budget info
    const run = await prisma.adapterRun.findFirst({
      where: { id: runLog.adapterRunId, householdId: ctx.householdId },
      include: { monthlyBudget: true },
    });

    if (!run) return { success: false, error: "Execução não encontrada" };

    // Reset log status and re-run
    await updateRunLogStatus(runLog.id, AdapterRunLogStatus.RUNNING, {
      errorMessage: undefined,
    });

    // Fire and forget
    (async () => {
      try {
        const result = await adapterModule.execute({
          householdId: ctx.householdId,
          budgetId: run.monthlyBudgetId,
          year: run.monthlyBudget.year,
          month: run.monthlyBudget.month,
          adapter: runLog.adapter,
        });

        if (!result.success) {
          await updateRunLogStatus(runLog.id, AdapterRunLogStatus.ERROR, {
            errorMessage: result.error ?? "Adapter returned failure",
          });
          return;
        }

        let expenseEntryId: number | undefined;
        let attachmentPath: string | undefined;

        if (result.expense) {
          if (result.expense.attachment) {
            attachmentPath = await saveAttachment(
              ctx.householdId,
              run.monthlyBudget.year,
              run.monthlyBudget.month,
              runLog.adapter.id,
              result.expense.attachment.filename,
              result.expense.attachment.data
            );
          }

          const expense = await createExpense(run.monthlyBudgetId, ctx.householdId, {
            description: result.expense.description,
            amount: result.expense.amount,
            categoryId: result.expense.categoryId,
            isPaid: false,
            source: ExpenseSource.ADAPTER,
            attachmentPath: attachmentPath ?? null,
          });

          if (expense) expenseEntryId = expense.id;
        }

        await updateRunLogStatus(runLog.id, AdapterRunLogStatus.SUCCESS, {
          expenseEntryId,
          attachmentPath,
        });
      } catch (error) {
        log.error({ error, logId }, "Retry failed");
        await updateRunLogStatus(runLog.id, AdapterRunLogStatus.ERROR, {
          errorMessage: error instanceof Error ? error.message : "Erro inesperado no retry",
        });
      }

      revalidatePath("/finances");
      revalidatePath("/finances/adapters");
    })();

    revalidatePath("/finances/adapters");
    return { success: true };
  } catch (error) {
    log.error({ error: serializeError(error) }, "Failed to retry adapter");
    return { success: false, error: "Erro ao reexecutar adaptador" };
  }
}
