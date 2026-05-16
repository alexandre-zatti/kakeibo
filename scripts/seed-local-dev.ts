import "dotenv/config";

import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

function assertLocalDatabase(url: string) {
  const parsed = new URL(url);
  const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  const databaseName = parsed.pathname.replace(/^\//, "");

  if (!localHosts.has(parsed.hostname) || databaseName !== "kakeibo") {
    throw new Error(
      `Refusing to seed non-local database "${parsed.hostname}/${databaseName}". ` +
        "seed:local is destructive and only runs against localhost/kakeibo."
    );
  }
}

assertLocalDatabase(DATABASE_URL);

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: DATABASE_URL }),
});

const DEV_USER_EMAIL = "dev@kakeibo.local";
const DEV_USER_PASSWORD = "kakeibo-dev";
const DEV_USER_NAME = "Local Dev";

const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth() + 1;
const previousMonthDate = new Date(currentYear, currentMonth - 2, 1);
const previousYear = previousMonthDate.getFullYear();
const previousMonth = previousMonthDate.getMonth() + 1;

type CategoryKey =
  | "Moradia"
  | "Alimentacao"
  | "Transporte"
  | "Lazer"
  | "Saude"
  | "Contas"
  | "Assinaturas"
  | "Pets"
  | "Taxas"
  | "Caixinhas"
  | "Salario"
  | "Freelance"
  | "Rendimentos"
  | "Outros";

function atUtc(year: number, month: number, day: number, hour = 12) {
  return new Date(Date.UTC(year, month - 1, day, hour, 0, 0));
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

async function resetAppDomainData() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "kakeibo"."adapter_run_log",
      "kakeibo"."adapter_run",
      "kakeibo"."adapter",
      "kakeibo"."google_connection",
      "kakeibo"."expense_entry",
      "kakeibo"."income_entry",
      "kakeibo"."monthly_budget",
      "kakeibo"."recurring_expense",
      "kakeibo"."savings_transaction",
      "kakeibo"."savings_box",
      "kakeibo"."category",
      "kakeibo"."household_member",
      "kakeibo"."household",
      "kakeibo"."product",
      "kakeibo"."purchase"
    RESTART IDENTITY CASCADE
  `);
}

async function ensureDevUser() {
  const passwordHash = await hashPassword(DEV_USER_PASSWORD);
  const existing = await prisma.user.findUnique({ where: { email: DEV_USER_EMAIL } });

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: DEV_USER_NAME,
          emailVerified: true,
          updatedAt: now,
        },
      })
    : await prisma.user.create({
        data: {
          id: "local-dev-user",
          name: DEV_USER_NAME,
          email: DEV_USER_EMAIL,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        },
      });

  await prisma.account.deleteMany({
    where: {
      userId: user.id,
      providerId: "credential",
      accountId: { not: user.id },
    },
  });

  await prisma.account.upsert({
    where: {
      providerId_accountId: {
        providerId: "credential",
        accountId: user.id,
      },
    },
    create: {
      id: "local-dev-credential-account",
      userId: user.id,
      providerId: "credential",
      accountId: user.id,
      password: passwordHash,
      createdAt: now,
      updatedAt: now,
    },
    update: {
      userId: user.id,
      password: passwordHash,
      updatedAt: now,
    },
  });

  return user;
}

function escapePdfText(value: string) {
  return value.replace(/[\\()]/g, "\\$&");
}

function createSimplePdf(lines: string[]) {
  const text = lines
    .map((line, index) => {
      const move = index === 0 ? "40 105 Td" : "0 -24 Td";
      return `${move} (${escapePdfText(line)}) Tj`;
    })
    .join("\n");
  const stream = `BT /F1 16 Tf\n${text}\nET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 360 160] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "utf8");
}

async function writeSeedAttachment(householdId: number) {
  const monthFolder = `${currentYear}-${String(currentMonth).padStart(2, "0")}`;
  const filePath = path.join(
    process.cwd(),
    "data",
    "uploads",
    "finances",
    String(householdId),
    monthFolder,
    "seed-celesc-bill.pdf"
  );

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(
    filePath,
    createSimplePdf(["Kakeibo seed attachment", "CELESC bill fixture", "Amount: R$ 214,77"])
  );

  return filePath;
}

async function seed() {
  const user = await ensureDevUser();
  await resetAppDomainData();

  const household = await prisma.household.create({
    data: {
      name: "Local Dev Household",
      members: {
        create: {
          userId: user.id,
          role: "owner",
        },
      },
    },
  });

  const categoryInputs: Array<{
    key: CategoryKey;
    type: "income" | "expense";
    sortOrder: number;
    color: string;
    icon: string;
  }> = [
    { key: "Moradia", type: "expense", sortOrder: 0, color: "#2563eb", icon: "home" },
    { key: "Alimentacao", type: "expense", sortOrder: 1, color: "#16a34a", icon: "utensils" },
    { key: "Transporte", type: "expense", sortOrder: 2, color: "#f97316", icon: "car" },
    { key: "Lazer", type: "expense", sortOrder: 3, color: "#db2777", icon: "ticket" },
    { key: "Saude", type: "expense", sortOrder: 4, color: "#dc2626", icon: "heart" },
    { key: "Contas", type: "expense", sortOrder: 5, color: "#7c3aed", icon: "receipt" },
    { key: "Assinaturas", type: "expense", sortOrder: 6, color: "#0891b2", icon: "repeat" },
    { key: "Pets", type: "expense", sortOrder: 7, color: "#ca8a04", icon: "paw-print" },
    { key: "Taxas", type: "expense", sortOrder: 8, color: "#475569", icon: "landmark" },
    { key: "Caixinhas", type: "expense", sortOrder: 9, color: "#059669", icon: "piggy-bank" },
    { key: "Salario", type: "income", sortOrder: 0, color: "#15803d", icon: "wallet" },
    { key: "Freelance", type: "income", sortOrder: 1, color: "#0f766e", icon: "briefcase" },
    { key: "Rendimentos", type: "income", sortOrder: 2, color: "#4f46e5", icon: "trending-up" },
    { key: "Outros", type: "income", sortOrder: 3, color: "#64748b", icon: "circle-dollar-sign" },
  ];

  const categories = {} as Record<CategoryKey, number>;
  for (const category of categoryInputs) {
    const created = await prisma.category.create({
      data: {
        name: category.key,
        type: category.type,
        sortOrder: category.sortOrder,
        color: category.color,
        icon: category.icon,
        householdId: household.id,
      },
    });
    categories[category.key] = created.id;
  }

  const previousBudget = await prisma.monthlyBudget.create({
    data: {
      householdId: household.id,
      year: previousYear,
      month: previousMonth,
      status: "closed",
      closedAt: atUtc(previousYear, previousMonth, 28),
      bankBalance: 1428.55,
    },
  });

  const currentBudget = await prisma.monthlyBudget.create({
    data: {
      householdId: household.id,
      year: currentYear,
      month: currentMonth,
      status: "open",
      bankBalance: 1684.3,
    },
  });

  await prisma.incomeEntry.createMany({
    data: [
      {
        description: "Salario principal",
        amount: 5800,
        categoryId: categories.Salario,
        monthlyBudgetId: previousBudget.id,
      },
      {
        description: "Projeto freelance",
        amount: 950,
        categoryId: categories.Freelance,
        monthlyBudgetId: previousBudget.id,
      },
      {
        description: "Salario principal",
        amount: 5900,
        categoryId: categories.Salario,
        monthlyBudgetId: currentBudget.id,
      },
      {
        description: "Projeto freelance",
        amount: 1200,
        categoryId: categories.Freelance,
        monthlyBudgetId: currentBudget.id,
      },
      {
        description: "Rendimento CDB",
        amount: 83.47,
        categoryId: categories.Rendimentos,
        monthlyBudgetId: currentBudget.id,
      },
    ],
  });

  const emergencyBox = await prisma.savingsBox.create({
    data: {
      name: "Reserva Emergencia",
      balance: 6500,
      monthlyTarget: 500,
      goalAmount: 12000,
      icon: "shield",
      color: "#15803d",
      householdId: household.id,
    },
  });
  const travelBox = await prisma.savingsBox.create({
    data: {
      name: "Viagem Japao",
      balance: 1850,
      monthlyTarget: 400,
      goalAmount: 9000,
      icon: "plane",
      color: "#2563eb",
      householdId: household.id,
    },
  });
  const homeBox = await prisma.savingsBox.create({
    data: {
      name: "Casa",
      balance: 2200,
      monthlyTarget: 300,
      goalAmount: null,
      icon: "home",
      color: "#f97316",
      householdId: household.id,
    },
  });

  await prisma.savingsTransaction.createMany({
    data: [
      {
        savingsBoxId: emergencyBox.id,
        type: "contribution",
        amount: 500,
        description: "Aporte mensal",
        source: "manual",
      },
      {
        savingsBoxId: emergencyBox.id,
        type: "withdrawal",
        amount: 180,
        description: "Ajuste farmacia",
        source: "expense_link",
      },
      {
        savingsBoxId: travelBox.id,
        type: "contribution",
        amount: 400,
        description: "Fechamento do mes anterior",
        source: "closing",
      },
      {
        savingsBoxId: homeBox.id,
        type: "contribution",
        amount: 300,
        description: "Aporte planejado",
        source: "manual",
      },
    ],
  });

  const attachmentPath = await writeSeedAttachment(household.id);

  await prisma.expenseEntry.createMany({
    data: [
      {
        description: "Aluguel",
        amount: 1800,
        categoryId: categories.Moradia,
        monthlyBudgetId: previousBudget.id,
        isPaid: true,
        paidAt: atUtc(previousYear, previousMonth, 5),
        source: "recurring",
      },
      {
        description: "Mercado mensal",
        amount: 612.88,
        categoryId: categories.Alimentacao,
        monthlyBudgetId: previousBudget.id,
        isPaid: true,
        paidAt: atUtc(previousYear, previousMonth, 10),
        source: "manual",
      },
      {
        description: "Internet",
        amount: 119.9,
        categoryId: categories.Contas,
        monthlyBudgetId: previousBudget.id,
        isPaid: true,
        paidAt: atUtc(previousYear, previousMonth, 12),
        source: "recurring",
      },
      {
        description: "Aluguel",
        amount: 1800,
        categoryId: categories.Moradia,
        monthlyBudgetId: currentBudget.id,
        isPaid: true,
        paidAt: atUtc(currentYear, currentMonth, 5),
        source: "recurring",
      },
      {
        description: "Mercado Angeloni",
        amount: 386.42,
        categoryId: categories.Alimentacao,
        monthlyBudgetId: currentBudget.id,
        isPaid: true,
        paidAt: atUtc(currentYear, currentMonth, 9),
        source: "manual",
      },
      {
        description: "Energia CELESC Maio",
        amount: 214.77,
        categoryId: categories.Contas,
        monthlyBudgetId: currentBudget.id,
        isPaid: false,
        source: "auto",
        attachmentPath,
      },
      {
        description: "Internet",
        amount: 119.9,
        categoryId: categories.Contas,
        monthlyBudgetId: currentBudget.id,
        isPaid: true,
        paidAt: atUtc(currentYear, currentMonth, 12),
        source: "recurring",
      },
      {
        description: "Cartao Nubank",
        amount: 742.3,
        categoryId: categories.Lazer,
        monthlyBudgetId: currentBudget.id,
        isPaid: false,
        source: "draft",
      },
      {
        description: "Aporte Reserva Emergencia",
        amount: 500,
        categoryId: categories.Caixinhas,
        monthlyBudgetId: currentBudget.id,
        isPaid: true,
        paidAt: atUtc(currentYear, currentMonth, 14),
        source: "manual",
        savingsBoxId: emergencyBox.id,
      },
    ],
  });

  const echoAdapter = await prisma.adapter.create({
    data: {
      name: "Echo Test Local",
      description: "Adapter local para validar execucao sem servicos externos.",
      moduleKey: "echo-test",
      config: { categoryId: categories.Contas },
      isActive: true,
      householdId: household.id,
    },
  });

  const celescAdapter = await prisma.adapter.create({
    data: {
      name: "CELESC Fatura",
      description: "Configuracao exemplo; requer Google OAuth real para buscar faturas.",
      moduleKey: "celesc-fatura",
      config: { categoryId: categories.Contas, queryDays: 45 },
      isActive: false,
      householdId: household.id,
    },
  });

  await prisma.adapter.create({
    data: {
      name: "Condominio",
      description: "Configuracao exemplo para fatura de condominio.",
      moduleKey: "condominio-fatura",
      config: { categoryId: categories.Moradia, queryDays: 45 },
      isActive: false,
      householdId: household.id,
    },
  });

  const run = await prisma.adapterRun.create({
    data: {
      status: "partial",
      completedAt: addDays(now, -1),
      householdId: household.id,
      monthlyBudgetId: currentBudget.id,
      logs: {
        create: [
          {
            adapterId: echoAdapter.id,
            status: "success",
            completedAt: addDays(now, -1),
          },
          {
            adapterId: celescAdapter.id,
            status: "error",
            errorMessage: "Credenciais Google ausentes no ambiente local.",
            completedAt: addDays(now, -1),
          },
        ],
      },
    },
  });

  await prisma.googleConnection.create({
    data: {
      email: DEV_USER_EMAIL,
      accessToken: "local-dev-access-token",
      refreshToken: "local-dev-refresh-token",
      expiresAt: addDays(now, 7),
      scopes:
        "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/userinfo.email",
      householdId: household.id,
    },
  });

  await prisma.recurringExpense.createMany({
    data: [
      {
        description: "Aluguel",
        amount: 1800,
        categoryId: categories.Moradia,
        householdId: household.id,
        isActive: true,
        dayOfMonth: 5,
      },
      {
        description: "Internet",
        amount: 119.9,
        categoryId: categories.Contas,
        householdId: household.id,
        isActive: true,
        dayOfMonth: 12,
      },
      {
        description: "Netflix",
        amount: 55.9,
        categoryId: categories.Assinaturas,
        householdId: household.id,
        isActive: true,
        dayOfMonth: 18,
      },
      {
        description: "Teste adapter mensal",
        amount: 1,
        categoryId: categories.Contas,
        householdId: household.id,
        isActive: true,
        dayOfMonth: 24,
        adapterId: echoAdapter.id,
      },
      {
        description: "Seguro carro",
        amount: 96,
        categoryId: categories.Transporte,
        householdId: household.id,
        isActive: false,
        dayOfMonth: 20,
      },
    ],
  });

  await prisma.purchase.create({
    data: {
      userId: user.id,
      status: 1,
      storeName: "Angeloni Centro",
      boughtAt: atUtc(currentYear, currentMonth, 9),
      totalValue: 386.42,
      createdAt: now,
      updatedAt: now,
      products: {
        create: [
          {
            code: "7891000100103",
            description: "Arroz integral 5kg",
            unitValue: 24.9,
            unitIdentifier: "UN",
            quantity: 1,
            totalValue: 24.9,
            createdAt: now,
            updatedAt: now,
          },
          {
            code: "7891000200200",
            description: "Cafe torrado 500g",
            unitValue: 18.99,
            unitIdentifier: "UN",
            quantity: 2,
            totalValue: 37.98,
            createdAt: now,
            updatedAt: now,
          },
          {
            code: "2000000000011",
            description: "Banana prata kg",
            unitValue: 6.49,
            unitIdentifier: "KG",
            quantity: 1.34,
            totalValue: 8.7,
            createdAt: now,
            updatedAt: now,
          },
        ],
      },
    },
  });

  await prisma.purchase.create({
    data: {
      userId: user.id,
      status: 2,
      storeName: "Mercado Comper",
      boughtAt: atUtc(currentYear, currentMonth, 13),
      totalValue: 214.18,
      createdAt: now,
      updatedAt: now,
      products: {
        create: [
          {
            code: "7894900010015",
            description: "Leite integral 1L",
            unitValue: 4.89,
            unitIdentifier: "UN",
            quantity: 6,
            totalValue: 29.34,
            createdAt: now,
            updatedAt: now,
          },
          {
            code: "7896000002000",
            description: "File de frango kg",
            unitValue: 21.9,
            unitIdentifier: "KG",
            quantity: 2.15,
            totalValue: 47.09,
            createdAt: now,
            updatedAt: now,
          },
          {
            code: "7897000003000",
            description: "Detergente neutro",
            unitValue: 2.79,
            unitIdentifier: "UN",
            quantity: 4,
            totalValue: 11.16,
            createdAt: now,
            updatedAt: now,
          },
        ],
      },
    },
  });

  await prisma.purchase.create({
    data: {
      userId: user.id,
      status: 1,
      storeName: "Farmacia Sao Joao",
      boughtAt: atUtc(previousYear, previousMonth, 22),
      totalValue: 97.35,
      createdAt: now,
      updatedAt: now,
      products: {
        create: [
          {
            code: "7898000004000",
            description: "Protetor solar FPS 50",
            unitValue: 52.9,
            unitIdentifier: "UN",
            quantity: 1,
            totalValue: 52.9,
            createdAt: now,
            updatedAt: now,
          },
          {
            code: "7899000005000",
            description: "Vitamina D",
            unitValue: 44.45,
            unitIdentifier: "UN",
            quantity: 1,
            totalValue: 44.45,
            createdAt: now,
            updatedAt: now,
          },
        ],
      },
    },
  });

  const counts = await Promise.all([
    prisma.household.count(),
    prisma.monthlyBudget.count(),
    prisma.incomeEntry.count(),
    prisma.expenseEntry.count(),
    prisma.savingsBox.count(),
    prisma.recurringExpense.count(),
    prisma.adapter.count(),
    prisma.adapterRun.count(),
    prisma.purchase.count({ where: { userId: user.id } }),
    prisma.product.count({ where: { purchase: { userId: user.id } } }),
  ]);

  console.log(
    JSON.stringify(
      {
        login: {
          email: DEV_USER_EMAIL,
          password: DEV_USER_PASSWORD,
        },
        currentMonth: `${currentYear}-${String(currentMonth).padStart(2, "0")}`,
        householdId: household.id,
        currentBudgetId: currentBudget.id,
        adapterRunId: run.id,
        counts: {
          households: counts[0],
          monthlyBudgets: counts[1],
          incomeEntries: counts[2],
          expenseEntries: counts[3],
          savingsBoxes: counts[4],
          recurringExpenses: counts[5],
          adapters: counts[6],
          adapterRuns: counts[7],
          purchases: counts[8],
          products: counts[9],
        },
      },
      null,
      2
    )
  );
}

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
