import { prisma } from "@/lib/prisma";
import logger from "@/lib/logger";
import type { AdapterRunWithLogs, SerializedAdapterRunLog } from "@/types/finances";
import { AdapterRunStatus, AdapterRunLogStatus } from "@/types/finances";

const log = logger.child({ module: "services/adapter-run" });

export async function getAdapterRuns(householdId: number): Promise<AdapterRunWithLogs[]> {
  const runs = await prisma.adapterRun.findMany({
    where: { householdId },
    orderBy: { createdAt: "desc" },
    include: {
      logs: {
        include: { adapter: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  return runs;
}

export async function getAdapterRunById(
  id: number,
  householdId: number
): Promise<AdapterRunWithLogs | null> {
  return prisma.adapterRun.findFirst({
    where: { id, householdId },
    include: {
      logs: {
        include: { adapter: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

export async function createAdapterRun(
  householdId: number,
  monthlyBudgetId: number,
  adapterIds: number[]
): Promise<AdapterRunWithLogs> {
  const run = await prisma.adapterRun.create({
    data: {
      status: AdapterRunStatus.RUNNING,
      householdId,
      monthlyBudgetId,
      logs: {
        create: adapterIds.map((adapterId) => ({
          status: AdapterRunLogStatus.PENDING,
          adapterId,
        })),
      },
    },
    include: {
      logs: {
        include: { adapter: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  log.info({ runId: run.id, adapterCount: adapterIds.length }, "Adapter run created");
  return run;
}

export async function updateRunLogStatus(
  logId: number,
  status: string,
  extra?: {
    errorMessage?: string;
    expenseEntryId?: number;
    attachmentPath?: string;
  }
): Promise<void> {
  await prisma.adapterRunLog.update({
    where: { id: logId },
    data: {
      status,
      ...(status === AdapterRunLogStatus.SUCCESS || status === AdapterRunLogStatus.ERROR
        ? { completedAt: new Date() }
        : {}),
      ...(extra?.errorMessage !== undefined && { errorMessage: extra.errorMessage }),
      ...(extra?.expenseEntryId !== undefined && { expenseEntryId: extra.expenseEntryId }),
      ...(extra?.attachmentPath !== undefined && { attachmentPath: extra.attachmentPath }),
    },
  });
}

export async function updateRunStatus(runId: number, status: string): Promise<void> {
  await prisma.adapterRun.update({
    where: { id: runId },
    data: {
      status,
      ...(status !== AdapterRunStatus.RUNNING ? { completedAt: new Date() } : {}),
    },
  });
}

export async function getRunLogById(
  logId: number,
  householdId: number
): Promise<SerializedAdapterRunLog | null> {
  const logEntry = await prisma.adapterRunLog.findFirst({
    where: {
      id: logId,
      adapterRun: { householdId },
    },
    include: { adapter: true },
  });

  return logEntry;
}
