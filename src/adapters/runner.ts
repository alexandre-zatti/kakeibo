import logger from "@/lib/logger";
import { getAdapterModule } from "./modules";
import { saveAttachment } from "./file-storage";
import {
  createExpense,
  updateExpenseFromAdapter,
  enrichExpenseAttachment,
} from "@/services/expense";
import { updateRunLogStatus, updateRunStatus } from "@/services/adapter-run";
import { AdapterRunStatus, AdapterRunLogStatus, ExpenseSource } from "@/types/finances";
import type { AdapterRunWithLogs, SerializedAdapter } from "@/types/finances";
import type { AdapterAction, AdapterContext, AdapterResult } from "./types";

const log = logger.child({ module: "adapters/runner" });

export async function processAdapterActions(
  actions: AdapterAction[],
  budgetId: number,
  householdId: number,
  year: number,
  month: number,
  adapterId: number
): Promise<{ expenseEntryId?: number; attachmentPath?: string }> {
  let expenseEntryId: number | undefined;
  let attachmentPath: string | undefined;

  for (const action of actions) {
    switch (action.type) {
      case "create_expense": {
        if (action.data.attachment) {
          attachmentPath = await saveAttachment(
            householdId,
            year,
            month,
            adapterId,
            action.data.attachment.filename,
            action.data.attachment.data
          );
        }
        const expense = await createExpense(budgetId, householdId, {
          description: action.data.description,
          amount: action.data.amount,
          categoryId: action.data.categoryId,
          isPaid: false,
          source: ExpenseSource.ADAPTER,
          attachmentPath: attachmentPath ?? null,
        });
        if (expense) expenseEntryId = expense.id;
        break;
      }
      case "update_expense": {
        if (action.data.attachment) {
          attachmentPath = await saveAttachment(
            householdId,
            year,
            month,
            adapterId,
            action.data.attachment.filename,
            action.data.attachment.data
          );
        }
        const { attachment: _attachment, ...updateData } = action.data;
        await updateExpenseFromAdapter(action.expenseId, householdId, {
          ...updateData,
          ...(attachmentPath ? { attachmentPath } : {}),
        });
        expenseEntryId = action.expenseId;
        break;
      }
      case "enrich_expense": {
        if (action.attachment) {
          attachmentPath = await saveAttachment(
            householdId,
            year,
            month,
            adapterId,
            action.attachment.filename,
            action.attachment.data
          );
          await enrichExpenseAttachment(action.expenseId, householdId, attachmentPath);
        }
        expenseEntryId = action.expenseId;
        break;
      }
    }
  }

  return { expenseEntryId, attachmentPath };
}

export async function executeSingleAdapter(
  adapter: SerializedAdapter,
  context: AdapterContext
): Promise<AdapterResult> {
  const adapterModule = getAdapterModule(adapter.moduleKey);
  if (!adapterModule) {
    return { success: false, error: `Module "${adapter.moduleKey}" not found`, actions: [] };
  }
  return adapterModule.execute(context);
}

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

      const { expenseEntryId, attachmentPath } = await processAdapterActions(
        result.actions,
        budgetId,
        householdId,
        year,
        month,
        runLog.adapter.id
      );

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
