import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import logger from "@/lib/logger";
import type { SerializedAdapter, AdapterWithLastRun } from "@/types/finances";

const log = logger.child({ module: "services/adapter" });

export async function getAdapters(householdId: number): Promise<AdapterWithLastRun[]> {
  const adapters = await prisma.adapter.findMany({
    where: { householdId },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: {
      runLogs: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { adapter: true },
      },
    },
  });

  return adapters.map((a: (typeof adapters)[number]) => ({
    ...a,
    lastRunLog: a.runLogs[0] ? { ...a.runLogs[0], adapter: a.runLogs[0].adapter } : null,
    runLogs: undefined,
  })) as AdapterWithLastRun[];
}

export async function getAdapterById(
  id: number,
  householdId: number
): Promise<SerializedAdapter | null> {
  return prisma.adapter.findFirst({
    where: { id, householdId },
  });
}

export async function createAdapter(
  householdId: number,
  data: {
    name: string;
    description?: string | null;
    moduleKey: string;
    config?: Prisma.InputJsonValue;
    isActive?: boolean;
  }
): Promise<SerializedAdapter> {
  const adapter = await prisma.adapter.create({
    data: {
      name: data.name,
      description: data.description ?? null,
      moduleKey: data.moduleKey,
      config: data.config ?? {},
      isActive: data.isActive ?? true,
      householdId,
    },
  });

  log.info({ adapterId: adapter.id, name: adapter.name }, "Adapter created");
  return adapter;
}

export async function updateAdapter(
  id: number,
  householdId: number,
  data: {
    name?: string;
    description?: string | null;
    moduleKey?: string;
    config?: Prisma.InputJsonValue;
    isActive?: boolean;
  }
): Promise<SerializedAdapter | null> {
  const existing = await prisma.adapter.findFirst({
    where: { id, householdId },
  });

  if (!existing) return null;

  const adapter = await prisma.adapter.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description ?? null }),
      ...(data.moduleKey !== undefined && { moduleKey: data.moduleKey }),
      ...(data.config !== undefined && { config: data.config }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  });

  log.info({ adapterId: id }, "Adapter updated");
  return adapter;
}

export async function deleteAdapter(
  id: number,
  householdId: number
): Promise<{ success: boolean; error?: string }> {
  const existing = await prisma.adapter.findFirst({
    where: { id, householdId },
    include: { _count: { select: { runLogs: true } } },
  });

  if (!existing) return { success: false, error: "Adaptador não encontrado" };

  await prisma.adapter.delete({ where: { id } });
  log.info({ adapterId: id }, "Adapter deleted");
  return { success: true };
}

export async function toggleAdapterActive(
  id: number,
  householdId: number,
  isActive: boolean
): Promise<SerializedAdapter | null> {
  const existing = await prisma.adapter.findFirst({
    where: { id, householdId },
  });

  if (!existing) return null;

  return prisma.adapter.update({
    where: { id },
    data: { isActive },
  });
}
