/**
 * Main migration script: Google Sheets → Kakeibo Database
 *
 * Usage: pnpm exec tsx scripts/migrate-sheets.ts [--dry-run]
 *
 * Prerequisites:
 * 1. JSON data files in scripts/data/ (exported from Google Sheets via MCP)
 * 2. .env with DATABASE_URL and GOOGLE_GEMINI_API_KEY
 * 3. A user account in the database (the script will use the first user found)
 * 4. Prisma client generated (pnpm exec prisma generate)
 */

import "dotenv/config";
import { readFileSync } from "fs";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  parseMonthlyTab,
  parseCaixinhasTab,
  collectUniqueDescriptions,
  parseCaixinhaDate,
  type MonthlySheetData,
  type CaixinhasSheetData,
  type ParsedMonth,
  type ParsedCaixinhaBox,
} from "./migrate-sheets-parser";
import {
  categorizeExpenses,
  getCategoryForExpense,
  type CategoryMapping,
} from "./migrate-sheets-categorize";

// ─── Setup ────────────────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes("--dry-run");
const CURRENT_YEAR = 2026;
const CURRENT_MONTH = 2; // February 2026

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// ─── Data Loading ─────────────────────────────────────────────────────────────

function loadMonthsData(): MonthlySheetData[] {
  const path = resolve(__dirname, "data/months.json");
  return JSON.parse(readFileSync(path, "utf-8"));
}

function loadCaixinhasData(): CaixinhasSheetData {
  const path = resolve(__dirname, "data/caixinhas.json");
  return JSON.parse(readFileSync(path, "utf-8"));
}

// ─── Migration Steps ──────────────────────────────────────────────────────────

async function getOrCreateHousehold(): Promise<{ householdId: number; userId: string }> {
  // Check if a household already exists (avoid duplicates on re-run)
  const existingMember = await prisma.householdMember.findFirst({
    include: { household: true },
  });

  if (existingMember) {
    console.log(
      `Using existing household: "${existingMember.household.name}" (ID: ${existingMember.householdId})`
    );
    return { householdId: existingMember.householdId, userId: existingMember.userId };
  }

  // Find the first user in the database
  const user = await prisma.user.findFirst();
  if (!user) {
    throw new Error("No user found in database. Please create an account first.");
  }

  console.log(`Creating household for user: ${user.name} (${user.email})`);

  const household = await prisma.$transaction(async (tx) => {
    const h = await tx.household.create({
      data: {
        name: "Eu & Mozi",
        members: {
          create: { userId: user.id, role: "owner" },
        },
      },
    });

    // Seed default categories
    const incomeCategories = ["Salario", "Freelance", "Rendimentos", "Outros"];
    const expenseCategories = [
      "Moradia",
      "Transporte",
      "Alimentacao",
      "Lazer",
      "Pets",
      "Seguros",
      "Taxas",
    ];

    await tx.category.createMany({
      data: [
        ...incomeCategories.map((name, i) => ({
          name,
          type: "income" as const,
          sortOrder: i,
          householdId: h.id,
        })),
        ...expenseCategories.map((name, i) => ({
          name,
          type: "expense" as const,
          sortOrder: i,
          householdId: h.id,
        })),
      ],
    });

    return h;
  });

  console.log(`Household created: "${household.name}" (ID: ${household.id})`);
  return { householdId: household.id, userId: user.id };
}

async function getCategoryMap(householdId: number): Promise<Record<string, number>> {
  const categories = await prisma.category.findMany({
    where: { householdId },
  });

  const map: Record<string, number> = {};
  for (const cat of categories) {
    map[`${cat.type}:${cat.name}`] = cat.id;
  }

  return map;
}

async function createSavingsBoxes(
  householdId: number,
  boxes: ParsedCaixinhaBox[]
): Promise<Record<string, number>> {
  const boxMap: Record<string, number> = {};

  for (const box of boxes) {
    // Check if box already exists
    const existing = await prisma.savingsBox.findFirst({
      where: { householdId, name: box.name },
    });

    if (existing) {
      console.log(`  Savings box "${box.name}" already exists (ID: ${existing.id})`);
      boxMap[box.name] = existing.id;
      continue;
    }

    if (DRY_RUN) {
      console.log(
        `  [DRY RUN] Would create savings box: ${box.name} (target: ${box.monthlyTarget}/month, goal: ${box.goalAmount})`
      );
      boxMap[box.name] = -1;
      continue;
    }

    const created = await prisma.savingsBox.create({
      data: {
        name: box.name,
        balance: 0, // Will be computed from transactions
        monthlyTarget: box.monthlyTarget,
        goalAmount: box.goalAmount,
        householdId,
      },
    });

    console.log(`  Created savings box: ${box.name} (ID: ${created.id})`);
    boxMap[box.name] = created.id;
  }

  return boxMap;
}

async function migrateCaixinhaTransactions(
  boxes: ParsedCaixinhaBox[],
  boxMap: Record<string, number>
): Promise<void> {
  for (const box of boxes) {
    const boxId = boxMap[box.name];
    if (!boxId || boxId === -1) continue;

    // Check if transactions already exist for this box
    const existingCount = await prisma.savingsTransaction.count({
      where: { savingsBoxId: boxId },
    });

    if (existingCount > 0) {
      console.log(
        `  Savings box "${box.name}" already has ${existingCount} transactions, skipping`
      );
      continue;
    }

    let runningBalance = 0;

    for (const tx of box.transactions) {
      const parsed = parseCaixinhaDate(tx.date);
      if (!parsed) continue;

      const isContribution = tx.amount > 0;
      const absAmount = Math.abs(tx.amount);
      runningBalance += tx.amount;

      if (DRY_RUN) continue;

      // Create a date in the middle of the month for the transaction
      const createdAt = new Date(parsed.year, parsed.month - 1, 15);

      await prisma.savingsTransaction.create({
        data: {
          type: isContribution ? "contribution" : "withdrawal",
          amount: absAmount,
          description: tx.description,
          savingsBoxId: boxId,
          source: "manual", // Historical data imported as manual
          createdAt,
        },
      });
    }

    // Update the box balance to match the running total
    if (!DRY_RUN) {
      await prisma.savingsBox.update({
        where: { id: boxId },
        data: { balance: runningBalance },
      });
    }

    console.log(
      `  ${box.name}: ${box.transactions.length} transactions, final balance: R$${runningBalance.toFixed(2)} (expected: R$${box.currentBalance.toFixed(2)})`
    );

    if (Math.abs(runningBalance - box.currentBalance) > 0.02) {
      console.warn(
        `  ⚠ Balance mismatch for ${box.name}: computed R$${runningBalance.toFixed(2)} vs spreadsheet R$${box.currentBalance.toFixed(2)}`
      );
    }
  }
}

async function migrateMonthlyBudgets(
  householdId: number,
  months: ParsedMonth[],
  categoryMapping: CategoryMapping,
  categoryMap: Record<string, number>,
  boxMap: Record<string, number>
): Promise<void> {
  // Sort months chronologically
  const sorted = [...months].sort((a, b) => a.year * 100 + a.month - (b.year * 100 + b.month));

  const defaultIncomeCatId = categoryMap["income:Salario"];
  if (!defaultIncomeCatId) {
    throw new Error("Default income category 'Salario' not found");
  }

  for (const month of sorted) {
    const isCurrentMonth = month.year === CURRENT_YEAR && month.month === CURRENT_MONTH;
    const status = isCurrentMonth ? "open" : "closed";

    console.log(
      `\n  ${month.sheetName} (${status}): income R$${month.totalIncome.toFixed(2)}, ${month.expenses.length} expenses`
    );

    // Check if budget already exists
    const existing = await prisma.monthlyBudget.findUnique({
      where: {
        householdId_year_month: {
          householdId,
          year: month.year,
          month: month.month,
        },
      },
    });

    if (existing) {
      console.log(`    Budget already exists (ID: ${existing.id}), skipping`);
      continue;
    }

    if (DRY_RUN) {
      console.log(`    [DRY RUN] Would create budget`);
      continue;
    }

    // Compute total expenses for bank balance (historical months only)
    const totalExpenses = month.expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalCaixinha = month.caixinhaContributions.reduce((sum, c) => sum + c.amount, 0);

    await prisma.$transaction(async (tx) => {
      // Create budget
      const closedAt = !isCurrentMonth ? new Date(month.year, month.month - 1, 28) : undefined;

      const budget = await tx.monthlyBudget.create({
        data: {
          year: month.year,
          month: month.month,
          status,
          closedAt,
          // For closed months, bank balance = income - expenses (reconciled)
          bankBalance: !isCurrentMonth ? month.totalIncome - totalExpenses : undefined,
          householdId,
        },
      });

      // Create single income entry
      if (month.totalIncome > 0) {
        await tx.incomeEntry.create({
          data: {
            description: "Renda mensal",
            amount: month.totalIncome,
            categoryId: defaultIncomeCatId,
            monthlyBudgetId: budget.id,
          },
        });
      }

      // Create expense entries
      for (const expense of month.expenses) {
        const categoryName = getCategoryForExpense(expense.description, categoryMapping);
        const categoryId = categoryMap[`expense:${categoryName}`];

        if (!categoryId) {
          console.warn(
            `    ⚠ Category not found for "${expense.description}" -> "${categoryName}"`
          );
          continue;
        }

        await tx.expenseEntry.create({
          data: {
            description: expense.description,
            amount: expense.amount,
            categoryId,
            monthlyBudgetId: budget.id,
            isPaid: expense.isPaid,
            paidAt: expense.isPaid ? new Date(month.year, month.month - 1, 15) : undefined,
            source: "manual",
          },
        });
      }

      console.log(
        `    Created: budget ID ${budget.id}, 1 income, ${month.expenses.length} expenses`
      );

      // Log caixinha contribution summary for this month (for cross-reference)
      if (totalCaixinha > 0) {
        const contribs = month.caixinhaContributions
          .filter((c) => c.amount > 0)
          .map((c) => `${c.boxName}: R$${c.amount.toFixed(2)}`)
          .join(", ");
        console.log(`    Caixinha contributions (from monthly tab): ${contribs}`);
      }
    });
  }
}

// ─── Verification ─────────────────────────────────────────────────────────────

async function verify(
  householdId: number,
  months: ParsedMonth[],
  boxes: ParsedCaixinhaBox[]
): Promise<void> {
  console.log("\n" + "=".repeat(60));
  console.log("VERIFICATION");
  console.log("=".repeat(60));

  // Count records
  const [budgetCount, incomeCount, expenseCount, boxCount, txCount] = await Promise.all([
    prisma.monthlyBudget.count({ where: { householdId } }),
    prisma.incomeEntry.count({ where: { monthlyBudget: { householdId } } }),
    prisma.expenseEntry.count({ where: { monthlyBudget: { householdId } } }),
    prisma.savingsBox.count({ where: { householdId } }),
    prisma.savingsTransaction.count({ where: { savingsBox: { householdId } } }),
  ]);

  const expectedExpenses = months.reduce((sum, m) => sum + m.expenses.length, 0);
  const expectedTx = boxes.reduce((sum, b) => sum + b.transactions.length, 0);

  console.log(`\nRecord counts:`);
  console.log(`  Monthly budgets: ${budgetCount} (expected: ${months.length})`);
  console.log(`  Income entries:  ${incomeCount} (expected: ${months.length})`);
  console.log(`  Expense entries: ${expenseCount} (expected: ${expectedExpenses})`);
  console.log(`  Savings boxes:   ${boxCount} (expected: ${boxes.length})`);
  console.log(`  Savings txns:    ${txCount} (expected: ${expectedTx})`);

  // Verify status distribution
  const openBudgets = await prisma.monthlyBudget.count({ where: { householdId, status: "open" } });
  const closedBudgets = await prisma.monthlyBudget.count({
    where: { householdId, status: "closed" },
  });
  console.log(`\nBudget status: ${openBudgets} open, ${closedBudgets} closed`);

  // Verify savings box balances
  console.log(`\nSavings box balances:`);
  const dbBoxes = await prisma.savingsBox.findMany({ where: { householdId } });
  for (const dbBox of dbBoxes) {
    const expected = boxes.find((b) => b.name === dbBox.name);
    const dbBalance = Number(dbBox.balance);
    const expectedBalance = expected?.currentBalance ?? 0;
    const match = Math.abs(dbBalance - expectedBalance) < 0.02 ? "OK" : "MISMATCH";
    console.log(
      `  ${dbBox.name}: R$${dbBalance.toFixed(2)} (expected: R$${expectedBalance.toFixed(2)}) [${match}]`
    );
  }

  // Total income and expense sums
  const totalIncomeSheet = months.reduce((sum, m) => sum + m.totalIncome, 0);
  const totalExpenseSheet = months.reduce(
    (sum, m) => sum + m.expenses.reduce((s, e) => s + e.amount, 0),
    0
  );

  const dbIncome = await prisma.incomeEntry.aggregate({
    where: { monthlyBudget: { householdId } },
    _sum: { amount: true },
  });
  const dbExpense = await prisma.expenseEntry.aggregate({
    where: { monthlyBudget: { householdId } },
    _sum: { amount: true },
  });

  console.log(`\nFinancial totals:`);
  console.log(
    `  Total income:  DB R$${Number(dbIncome._sum.amount || 0).toFixed(2)} vs Sheet R$${totalIncomeSheet.toFixed(2)}`
  );
  console.log(
    `  Total expense: DB R$${Number(dbExpense._sum.amount || 0).toFixed(2)} vs Sheet R$${totalExpenseSheet.toFixed(2)}`
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("=".repeat(60));
  console.log("KAKEIBO DATA MIGRATION - Google Sheets → Database");
  console.log("=".repeat(60));

  if (DRY_RUN) {
    console.log("🏃 DRY RUN MODE - No data will be written\n");
  }

  // 1. Load and parse data
  console.log("\n[1/6] Loading data from JSON files...");
  const monthsRaw = loadMonthsData();
  const caixinhasRaw = loadCaixinhasData();

  const months = monthsRaw.map(parseMonthlyTab);
  const boxes = parseCaixinhasTab(caixinhasRaw);

  console.log(`  Parsed ${months.length} months and ${boxes.length} savings boxes`);

  // 2. Categorize expenses
  console.log("\n[2/6] Categorizing expenses...");
  const uniqueDescriptions = collectUniqueDescriptions(months);
  console.log(`  Found ${uniqueDescriptions.length} unique expense descriptions`);
  const categoryMapping = await categorizeExpenses(uniqueDescriptions);

  // 3. Get or create household
  console.log("\n[3/6] Setting up household...");
  const { householdId } = await getOrCreateHousehold();

  // 4. Get category ID map
  const categoryMap = await getCategoryMap(householdId);
  console.log(`  ${Object.keys(categoryMap).length} categories available`);

  // 5. Create savings boxes
  console.log("\n[4/6] Creating savings boxes...");
  const boxMap = await createSavingsBoxes(householdId, boxes);

  // 6. Migrate caixinha transactions
  console.log("\n[5/6] Migrating savings transactions...");
  await migrateCaixinhaTransactions(boxes, boxMap);

  // 7. Migrate monthly budgets
  console.log("\n[6/6] Migrating monthly budgets...");
  await migrateMonthlyBudgets(householdId, months, categoryMapping, categoryMap, boxMap);

  // 8. Verify
  if (!DRY_RUN) {
    await verify(householdId, months, boxes);
  }

  console.log("\n" + "=".repeat(60));
  console.log("MIGRATION COMPLETE");
  console.log("=".repeat(60));
}

main()
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
