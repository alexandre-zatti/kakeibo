import { prisma } from "@/lib/prisma";
import logger, { serializeError } from "@/lib/logger";
import type {
  SerializedSavingsBox,
  SerializedSavingsTransaction,
  SavingsBoxWithHistory,
} from "@/types/finances";
import type {
  CreateSavingsBoxInput,
  UpdateSavingsBoxInput,
  CreateSavingsTransactionInput,
} from "@/lib/schemas/finances";

const log = logger.child({ module: "services/savings-box" });

function serializeBox(box: {
  balance: unknown;
  monthlyTarget: unknown;
  goalAmount: unknown;
  [key: string]: unknown;
}): SerializedSavingsBox {
  return {
    ...box,
    balance: Number(box.balance),
    monthlyTarget: box.monthlyTarget ? Number(box.monthlyTarget) : null,
    goalAmount: box.goalAmount ? Number(box.goalAmount) : null,
  } as SerializedSavingsBox;
}

function serializeTransaction(tx: {
  amount: unknown;
  [key: string]: unknown;
}): SerializedSavingsTransaction {
  return { ...tx, amount: Number(tx.amount) } as SerializedSavingsTransaction;
}

export async function getSavingsBoxes(householdId: number): Promise<SerializedSavingsBox[]> {
  log.debug({ householdId }, "Fetching savings boxes");

  try {
    const boxes = await prisma.savingsBox.findMany({
      where: { householdId },
      orderBy: { name: "asc" },
    });

    return boxes.map(serializeBox);
  } catch (error) {
    log.error({ error: serializeError(error), householdId }, "Failed to fetch savings boxes");
    throw error;
  }
}

export async function getSavingsBoxById(
  id: number,
  householdId: number
): Promise<SavingsBoxWithHistory | null> {
  log.debug({ id, householdId }, "Fetching savings box by ID");

  try {
    const box = await prisma.savingsBox.findUnique({
      where: { id },
      include: {
        transactions: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!box || box.householdId !== householdId) {
      return null;
    }

    const serialized = serializeBox(box);
    const goalProgress =
      serialized.goalAmount && serialized.goalAmount > 0
        ? Math.min((serialized.balance / serialized.goalAmount) * 100, 100)
        : null;

    return {
      ...serialized,
      transactions: box.transactions.map(serializeTransaction),
      goalProgress,
    };
  } catch (error) {
    log.error({ error: serializeError(error), id }, "Failed to fetch savings box");
    throw error;
  }
}

export async function createSavingsBox(
  householdId: number,
  data: CreateSavingsBoxInput
): Promise<SerializedSavingsBox> {
  log.debug({ householdId, name: data.name }, "Creating savings box");

  try {
    const box = await prisma.savingsBox.create({
      data: {
        name: data.name,
        monthlyTarget: data.monthlyTarget ?? null,
        goalAmount: data.goalAmount ?? null,
        icon: data.icon ?? null,
        color: data.color ?? null,
        householdId,
      },
    });

    log.info({ id: box.id, householdId }, "Savings box created");
    return serializeBox(box);
  } catch (error) {
    log.error({ error: serializeError(error), householdId }, "Failed to create savings box");
    throw error;
  }
}

export async function updateSavingsBox(
  id: number,
  householdId: number,
  data: UpdateSavingsBoxInput
): Promise<SerializedSavingsBox | null> {
  log.debug({ id, householdId }, "Updating savings box");

  try {
    const existing = await prisma.savingsBox.findUnique({ where: { id } });

    if (!existing || existing.householdId !== householdId) {
      return null;
    }

    const updated = await prisma.savingsBox.update({
      where: { id },
      data: {
        ...data,
        monthlyTarget: data.monthlyTarget === undefined ? undefined : (data.monthlyTarget ?? null),
        goalAmount: data.goalAmount === undefined ? undefined : (data.goalAmount ?? null),
        icon: data.icon === undefined ? undefined : (data.icon ?? null),
        color: data.color === undefined ? undefined : (data.color ?? null),
      },
    });

    log.info({ id, householdId }, "Savings box updated");
    return serializeBox(updated);
  } catch (error) {
    log.error({ error: serializeError(error), id }, "Failed to update savings box");
    throw error;
  }
}

export async function deleteSavingsBox(
  id: number,
  householdId: number
): Promise<{ success: boolean; error?: string }> {
  log.debug({ id, householdId }, "Deleting savings box");

  try {
    const existing = await prisma.savingsBox.findUnique({ where: { id } });

    if (!existing || existing.householdId !== householdId) {
      return { success: false, error: "Caixinha não encontrada" };
    }

    if (Number(existing.balance) > 0) {
      return { success: false, error: "Caixinha possui saldo, retire antes de excluir" };
    }

    await prisma.savingsBox.delete({ where: { id } });

    log.info({ id, householdId }, "Savings box deleted");
    return { success: true };
  } catch (error) {
    log.error({ error: serializeError(error), id }, "Failed to delete savings box");
    throw error;
  }
}

export async function addTransaction(
  boxId: number,
  householdId: number,
  data: CreateSavingsTransactionInput
): Promise<SerializedSavingsTransaction | null> {
  log.debug({ boxId, householdId, type: data.type }, "Adding savings transaction");

  try {
    const box = await prisma.savingsBox.findUnique({ where: { id: boxId } });

    if (!box || box.householdId !== householdId) {
      return null;
    }

    // Validate withdrawal doesn't exceed balance
    if (data.type === "withdrawal" && data.amount > Number(box.balance)) {
      return null;
    }

    const result = await prisma.$transaction(async (tx) => {
      const transaction = await tx.savingsTransaction.create({
        data: {
          type: data.type,
          amount: data.amount,
          description: data.description ?? null,
          savingsBoxId: boxId,
          source: data.source,
        },
      });

      const increment = data.type === "contribution" ? data.amount : -data.amount;
      await tx.savingsBox.update({
        where: { id: boxId },
        data: { balance: { increment } },
      });

      return transaction;
    });

    log.info({ txId: result.id, boxId, householdId }, "Savings transaction added");
    return serializeTransaction(result);
  } catch (error) {
    log.error({ error: serializeError(error), boxId }, "Failed to add transaction");
    throw error;
  }
}

export async function distributeClosingBalance(
  householdId: number,
  allocations: { savingsBoxId: number; amount: number }[]
): Promise<void> {
  log.debug({ householdId, allocations: allocations.length }, "Distributing closing balance");

  try {
    await prisma.$transaction(async (tx) => {
      for (const { savingsBoxId, amount } of allocations) {
        // Verify box belongs to household
        const box = await tx.savingsBox.findUnique({ where: { id: savingsBoxId } });
        if (!box || box.householdId !== householdId) {
          throw new Error(`Caixinha ${savingsBoxId} não pertence ao household`);
        }

        await tx.savingsTransaction.create({
          data: {
            type: "contribution",
            amount,
            description: "Distribuição de fechamento",
            savingsBoxId,
            source: "closing",
          },
        });

        await tx.savingsBox.update({
          where: { id: savingsBoxId },
          data: { balance: { increment: amount } },
        });
      }
    });

    log.info({ householdId, allocations: allocations.length }, "Closing balance distributed");
  } catch (error) {
    log.error({ error: serializeError(error), householdId }, "Failed to distribute balance");
    throw error;
  }
}
