import logger from "@/lib/logger";
import { getAdapterModule } from "./modules";
import { saveAttachment } from "./file-storage";
import { createExpense } from "@/services/expense";
import { updateRunLogStatus, updateRunStatus } from "@/services/adapter-run";
import { AdapterRunStatus, AdapterRunLogStatus, ExpenseSource } from "@/types/finances";
import type { AdapterRunWithLogs } from "@/types/finances";
import type { AdapterContext } from "./types";

const log = logger.child({ module: "adapters/runner" });

export async function executeAdapterRun(
  run: AdapterRunWithLogs,
  budgetId: number,
  householdId: number,
  year: number,
  month: number
): Promise<void> {
  log.info({ runId: run.id, logCount: run.logs.length }, "Starting adapter run");

  let successCount = 0;
  let errorCount = 0;

  for (const runLog of run.logs) {
    const adapterModule = getAdapterModule(runLog.adapter.moduleKey);

    if (!adapterModule) {
      log.warn({ moduleKey: runLog.adapter.moduleKey }, "Adapter module not found");
      await updateRunLogStatus(runLog.id, AdapterRunLogStatus.ERROR, {
        errorMessage: `Módulo "${runLog.adapter.moduleKey}" não encontrado no registro`,
      });
      errorCount++;
      continue;
    }

    try {
      await updateRunLogStatus(runLog.id, AdapterRunLogStatus.RUNNING);

      const context: AdapterContext = {
        householdId,
        budgetId,
        year,
        month,
        adapter: runLog.adapter,
      };

      const result = await adapterModule.execute(context);

      if (!result.success) {
        await updateRunLogStatus(runLog.id, AdapterRunLogStatus.ERROR, {
          errorMessage: result.error ?? "Adapter returned failure",
        });
        errorCount++;
        continue;
      }

      let expenseEntryId: number | undefined;
      let attachmentPath: string | undefined;

      if (result.expense) {
        // Save attachment first if present
        if (result.expense.attachment) {
          attachmentPath = await saveAttachment(
            householdId,
            year,
            month,
            runLog.adapter.id,
            result.expense.attachment.filename,
            result.expense.attachment.data
          );
        }

        // Create expense entry
        const expense = await createExpense(budgetId, householdId, {
          description: result.expense.description,
          amount: result.expense.amount,
          categoryId: result.expense.categoryId,
          isPaid: false,
          source: ExpenseSource.ADAPTER,
          attachmentPath: attachmentPath ?? null,
        });

        if (expense) {
          expenseEntryId = expense.id;
        }
      }

      await updateRunLogStatus(runLog.id, AdapterRunLogStatus.SUCCESS, {
        expenseEntryId,
        attachmentPath,
      });
      successCount++;

      log.info(
        { adapterId: runLog.adapter.id, expenseCreated: !!expenseEntryId },
        "Adapter completed successfully"
      );
    } catch (error) {
      log.error({ error, adapterId: runLog.adapter.id }, "Adapter execution failed");
      await updateRunLogStatus(runLog.id, AdapterRunLogStatus.ERROR, {
        errorMessage: error instanceof Error ? error.message : "Erro inesperado",
      });
      errorCount++;
    }
  }

  // Determine final run status
  const finalStatus =
    errorCount === 0
      ? AdapterRunStatus.COMPLETED
      : successCount === 0
        ? AdapterRunStatus.FAILED
        : AdapterRunStatus.PARTIAL;

  await updateRunStatus(run.id, finalStatus);
  log.info({ runId: run.id, finalStatus, successCount, errorCount }, "Adapter run finished");
}
