import { prisma } from "@/lib/prisma";
import logger, { serializeError } from "@/lib/logger";
import type { SerializedCategory } from "@/types/finances";
import type { CreateCategoryInput, UpdateCategoryInput } from "@/lib/schemas/finances";
import type { PrismaClient } from "@prisma/client";

const log = logger.child({ module: "services/category" });

type TransactionClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

const DEFAULT_INCOME_CATEGORIES = ["Salario", "Freelance", "Rendimentos", "Outros"];

const DEFAULT_EXPENSE_CATEGORIES = [
  "Moradia",
  "Transporte",
  "Alimentacao",
  "Lazer",
  "Pets",
  "Seguros",
  "Taxas",
];

export async function getCategoriesByHousehold(
  householdId: number,
  type?: "income" | "expense"
): Promise<SerializedCategory[]> {
  log.debug({ householdId, type }, "Fetching categories");

  try {
    const categories = await prisma.category.findMany({
      where: { householdId, ...(type ? { type } : {}) },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return categories;
  } catch (error) {
    log.error({ error: serializeError(error), householdId }, "Failed to fetch categories");
    throw error;
  }
}

export async function createCategory(
  householdId: number,
  data: CreateCategoryInput
): Promise<SerializedCategory> {
  log.debug({ householdId, name: data.name, type: data.type }, "Creating category");

  try {
    const category = await prisma.category.create({
      data: {
        ...data,
        householdId,
      },
    });

    log.info({ categoryId: category.id, householdId }, "Category created");
    return category;
  } catch (error) {
    log.error({ error: serializeError(error), householdId }, "Failed to create category");
    throw error;
  }
}

export async function updateCategory(
  categoryId: number,
  householdId: number,
  data: UpdateCategoryInput
): Promise<SerializedCategory | null> {
  log.debug({ categoryId, householdId }, "Updating category");

  try {
    const existing = await prisma.category.findUnique({ where: { id: categoryId } });

    if (!existing || existing.householdId !== householdId) {
      return null;
    }

    const updated = await prisma.category.update({
      where: { id: categoryId },
      data,
    });

    log.info({ categoryId, householdId }, "Category updated");
    return updated;
  } catch (error) {
    log.error({ error: serializeError(error), categoryId }, "Failed to update category");
    throw error;
  }
}

export async function deleteCategory(
  categoryId: number,
  householdId: number
): Promise<{ success: boolean; error?: string }> {
  log.debug({ categoryId, householdId }, "Deleting category");

  try {
    const existing = await prisma.category.findUnique({ where: { id: categoryId } });

    if (!existing || existing.householdId !== householdId) {
      return { success: false, error: "Categoria não encontrada" };
    }

    // Check if category is in use
    const [incomeCount, expenseCount, recurringCount] = await Promise.all([
      prisma.incomeEntry.count({ where: { categoryId } }),
      prisma.expenseEntry.count({ where: { categoryId } }),
      prisma.recurringExpense.count({ where: { categoryId } }),
    ]);

    if (incomeCount + expenseCount + recurringCount > 0) {
      return { success: false, error: "Categoria em uso, não pode ser removida" };
    }

    await prisma.category.delete({ where: { id: categoryId } });

    log.info({ categoryId, householdId }, "Category deleted");
    return { success: true };
  } catch (error) {
    log.error({ error: serializeError(error), categoryId }, "Failed to delete category");
    throw error;
  }
}

export async function seedDefaultCategories(
  householdId: number,
  tx?: TransactionClient
): Promise<void> {
  const client = tx ?? prisma;

  const data = [
    ...DEFAULT_INCOME_CATEGORIES.map((name, i) => ({
      name,
      type: "income" as const,
      sortOrder: i,
      householdId,
    })),
    ...DEFAULT_EXPENSE_CATEGORIES.map((name, i) => ({
      name,
      type: "expense" as const,
      sortOrder: i,
      householdId,
    })),
  ];

  await client.category.createMany({ data });

  log.info({ householdId, count: data.length }, "Default categories seeded");
}
