# Finance Adapters Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an adapter system that automates bill collection from external sources (Gmail, Google Drive) into monthly expenses with attachments, triggered manually with async execution and a management UI.

**Architecture:** Code modules provide adapter execution logic (TypeScript files in `src/adapters/modules/`). DB records provide CRUD, activation state, and run tracking. A runner orchestrates sequential async execution after an API call returns immediately. Files stored server-side, viewed via RSC.

**Tech Stack:** Next.js 15, Prisma, Zod, React 19, shadcn/ui, googleapis (Gmail/Drive), pino

**Design doc:** `docs/plans/2026-02-27-finance-adapters-design.md`

---

## Task 1: Database Schema — New Models + ExpenseEntry Changes

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add Adapter model to Prisma schema**

After the `SavingsTransaction` model (end of file), add:

```prisma
model Adapter {
  id          Int      @id @default(autoincrement())
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  name        String   @db.VarChar(255)
  description String?  @db.Text
  moduleKey   String   @db.VarChar(100)
  isActive    Boolean  @default(true)
  householdId Int

  household   Household      @relation(fields: [householdId], references: [id])
  runLogs     AdapterRunLog[]

  @@unique([householdId, name])
}
```

**Step 2: Add AdapterRun model**

```prisma
model AdapterRun {
  id              Int       @id @default(autoincrement())
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  status          String    @db.VarChar(20) @default("running")
  completedAt     DateTime?
  householdId     Int
  monthlyBudgetId Int

  household       Household      @relation(fields: [householdId], references: [id])
  monthlyBudget   MonthlyBudget  @relation(fields: [monthlyBudgetId], references: [id])
  logs            AdapterRunLog[]
}
```

**Step 3: Add AdapterRunLog model**

```prisma
model AdapterRunLog {
  id             Int       @id @default(autoincrement())
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  status         String    @db.VarChar(20) @default("pending")
  errorMessage   String?   @db.Text
  attachmentPath String?   @db.VarChar(500)
  completedAt    DateTime?
  adapterRunId   Int
  adapterId      Int
  expenseEntryId Int?

  adapterRun     AdapterRun   @relation(fields: [adapterRunId], references: [id])
  adapter        Adapter      @relation(fields: [adapterId], references: [id])
  expenseEntry   ExpenseEntry? @relation(fields: [expenseEntryId], references: [id])
}
```

**Step 4: Add `attachmentPath` to ExpenseEntry model**

In the existing `ExpenseEntry` model, add after the `recurringExpenseId` field:

```prisma
  attachmentPath     String?          @db.VarChar(500)
```

**Step 5: Add relation fields to Household model**

Add to the `Household` model relations:

```prisma
  adapters         Adapter[]
  adapterRuns      AdapterRun[]
```

**Step 6: Add relation fields to MonthlyBudget model**

Add to `MonthlyBudget`:

```prisma
  adapterRuns    AdapterRun[]
```

**Step 7: Add relation field to ExpenseEntry model**

Add to `ExpenseEntry`:

```prisma
  adapterRunLogs AdapterRunLog[]
```

**Step 8: Run migration**

```bash
pnpm exec prisma migrate dev --name add-adapter-models
```

**Step 9: Verify Prisma client generation**

```bash
pnpm exec prisma generate
```

**Step 10: Commit**

```bash
git add prisma/
git commit -m "Add adapter database models and ExpenseEntry.attachmentPath"
```

---

## Task 2: TypeScript Types + Zod Schemas

**Files:**
- Modify: `src/types/finances.ts`
- Modify: `src/lib/schemas/finances.ts`

**Step 1: Add adapter constants to `src/types/finances.ts`**

Add after the existing `HouseholdRole` constant:

```typescript
export const AdapterRunStatus = {
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
  PARTIAL: "partial",
} as const;

export const AdapterRunLogStatus = {
  PENDING: "pending",
  RUNNING: "running",
  SUCCESS: "success",
  ERROR: "error",
  SKIPPED: "skipped",
} as const;
```

**Step 2: Add `ADAPTER` to the existing `ExpenseSource` constant**

In `src/types/finances.ts`, update `ExpenseSource`:

```typescript
export const ExpenseSource = {
  MANUAL: "manual",
  DRAFT: "draft",
  AUTO: "auto",
  RECURRING: "recurring",
  ADAPTER: "adapter",
} as const;
```

**Step 3: Add serialized adapter types**

Add after the existing serialized types:

```typescript
import type {
  Adapter,
  AdapterRun,
  AdapterRunLog,
} from "@/generated/prisma";

export type SerializedAdapter = Adapter;

export type SerializedAdapterRun = AdapterRun;

export type SerializedAdapterRunLog = AdapterRunLog & {
  adapter: SerializedAdapter;
};

export type AdapterRunWithLogs = SerializedAdapterRun & {
  logs: SerializedAdapterRunLog[];
};

export type AdapterWithLastRun = SerializedAdapter & {
  lastRunLog?: SerializedAdapterRunLog | null;
};
```

**Step 4: Update `SerializedExpenseEntry` to include `attachmentPath`**

The `SerializedExpenseEntry` type should already pick up `attachmentPath` from the Prisma type since it's a `string | null` (not a Decimal). Verify this by checking the type extends pattern. If `SerializedExpenseEntry` uses `Omit<ExpenseEntry, "amount">`, it already includes the new field. No change needed.

**Step 5: Add Zod schemas to `src/lib/schemas/finances.ts`**

Add after the existing `monthParamsSchema`:

```typescript
export const createAdapterSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(255, "Nome muito longo"),
  description: z.string().max(1000, "Descrição muito longa").optional().nullable(),
  moduleKey: z.string().min(1, "Módulo é obrigatório").max(100),
  isActive: z.boolean().default(true),
});

export const updateAdapterSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(255).optional(),
  description: z.string().max(1000).optional().nullable(),
  moduleKey: z.string().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
});
```

**Step 6: Update `createExpenseSchema` source enum**

Update the `source` field to include `"adapter"`:

```typescript
  source: z.enum(["manual", "draft", "auto", "recurring", "adapter"]).default("manual"),
```

**Step 7: Run lint + typecheck**

```bash
pnpm exec prettier --write src/types/finances.ts src/lib/schemas/finances.ts
pnpm lint:fix
pnpm exec tsc --noEmit
```

**Step 8: Commit**

```bash
git add src/types/finances.ts src/lib/schemas/finances.ts
git commit -m "Add adapter types, constants, and Zod schemas"
```

---

## Task 3: Adapter Interface + Module Registry

**Files:**
- Create: `src/adapters/types.ts`
- Create: `src/adapters/modules/index.ts`
- Create: `src/adapters/modules/echo-test.ts` (test adapter for development)

**Step 1: Create adapter interface types**

Create `src/adapters/types.ts`:

```typescript
import type { SerializedAdapter } from "@/types/finances";

export interface AdapterModule {
  /** Human-readable label for module selection in UI */
  label: string;
  /** Short description of what this module does */
  description: string;
  /** The execution function */
  execute: (context: AdapterContext) => Promise<AdapterResult>;
}

export interface AdapterContext {
  /** The household this adapter runs for */
  householdId: number;
  /** The monthly budget being populated */
  budgetId: number;
  /** Year/month of the budget */
  year: number;
  month: number;
  /** The adapter DB record */
  adapter: SerializedAdapter;
}

export interface AdapterResult {
  /** Was the adapter execution successful? */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** The expense data to create (omit if no bill found) */
  expense?: {
    description: string;
    amount: number;
    categoryId: number;
    /** Optional attachment file */
    attachment?: {
      filename: string;
      mimeType: string;
      /** Raw file buffer */
      data: Buffer;
    };
  };
}
```

**Step 2: Create echo-test adapter module (for development/testing)**

Create `src/adapters/modules/echo-test.ts`:

```typescript
import type { AdapterModule } from "../types";

export const echoTest: AdapterModule = {
  label: "Echo Test",
  description: "Test adapter that creates a dummy expense. For development only.",

  async execute(context) {
    return {
      success: true,
      expense: {
        description: `[Test] Adapter echo - ${context.adapter.name}`,
        amount: 1.0,
        categoryId: 1,
      },
    };
  },
};
```

**Step 3: Create module registry**

Create `src/adapters/modules/index.ts`:

```typescript
import type { AdapterModule } from "../types";
import { echoTest } from "./echo-test";

export const adapterModules: Record<string, AdapterModule> = {
  "echo-test": echoTest,
};

export function getAdapterModule(key: string): AdapterModule | undefined {
  return adapterModules[key];
}

export function getAvailableModules(): { key: string; label: string; description: string }[] {
  return Object.entries(adapterModules).map(([key, mod]) => ({
    key,
    label: mod.label,
    description: mod.description,
  }));
}
```

**Step 4: Run lint + typecheck**

```bash
pnpm exec prettier --write src/adapters/
pnpm lint:fix
pnpm exec tsc --noEmit
```

**Step 5: Commit**

```bash
git add src/adapters/
git commit -m "Add adapter interface, echo-test module, and module registry"
```

---

## Task 4: File Storage Utility

**Files:**
- Create: `src/adapters/file-storage.ts`

**Step 1: Create file storage utility**

Create `src/adapters/file-storage.ts`:

```typescript
import fs from "node:fs/promises";
import path from "node:path";
import logger from "@/lib/logger";

const log = logger.child({ module: "adapters/file-storage" });

const UPLOADS_BASE = path.join(process.cwd(), "data", "uploads", "finances");

function buildFilePath(
  householdId: number,
  year: number,
  month: number,
  adapterId: number,
  filename: string,
): string {
  const monthStr = `${year}-${String(month).padStart(2, "0")}`;
  const timestamp = Date.now();
  const ext = path.extname(filename) || ".bin";
  const safeName = `adapter-${adapterId}-${timestamp}${ext}`;
  return path.join(UPLOADS_BASE, String(householdId), monthStr, safeName);
}

export async function saveAttachment(
  householdId: number,
  year: number,
  month: number,
  adapterId: number,
  filename: string,
  data: Buffer,
): Promise<string> {
  const filePath = buildFilePath(householdId, year, month, adapterId, filename);
  const dir = path.dirname(filePath);

  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, data);

  log.info({ filePath, size: data.length }, "Saved adapter attachment");
  return filePath;
}

export async function readAttachment(filePath: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(filePath);
  } catch {
    log.warn({ filePath }, "Attachment file not found");
    return null;
  }
}

export function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
  };
  return mimeTypes[ext] ?? "application/octet-stream";
}
```

**Step 2: Add `data/` to `.gitignore`**

Append to `.gitignore`:

```
# Adapter file uploads
data/
```

**Step 3: Run lint + typecheck**

```bash
pnpm exec prettier --write src/adapters/file-storage.ts
pnpm lint:fix
pnpm exec tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/adapters/file-storage.ts .gitignore
git commit -m "Add file storage utility for adapter attachments"
```

---

## Task 5: Adapter CRUD Service

**Files:**
- Create: `src/services/adapter.ts`

**Step 1: Create adapter CRUD service**

Create `src/services/adapter.ts`:

```typescript
import prisma from "@/lib/prisma";
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

  return adapters.map((a) => ({
    ...a,
    lastRunLog: a.runLogs[0]
      ? { ...a.runLogs[0], adapter: a.runLogs[0].adapter }
      : null,
    runLogs: undefined,
  })) as AdapterWithLastRun[];
}

export async function getAdapterById(
  id: number,
  householdId: number,
): Promise<SerializedAdapter | null> {
  return prisma.adapter.findFirst({
    where: { id, householdId },
  });
}

export async function createAdapter(
  householdId: number,
  data: { name: string; description?: string | null; moduleKey: string; isActive?: boolean },
): Promise<SerializedAdapter> {
  const adapter = await prisma.adapter.create({
    data: {
      name: data.name,
      description: data.description ?? null,
      moduleKey: data.moduleKey,
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
  data: { name?: string; description?: string | null; moduleKey?: string; isActive?: boolean },
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
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  });

  log.info({ adapterId: id }, "Adapter updated");
  return adapter;
}

export async function deleteAdapter(
  id: number,
  householdId: number,
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
  isActive: boolean,
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
```

**Step 2: Run lint + typecheck**

```bash
pnpm exec prettier --write src/services/adapter.ts
pnpm lint:fix
pnpm exec tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/services/adapter.ts
git commit -m "Add adapter CRUD service"
```

---

## Task 6: Adapter Run Service + Runner

**Files:**
- Create: `src/services/adapter-run.ts`
- Create: `src/adapters/runner.ts`

**Step 1: Create adapter run service**

Create `src/services/adapter-run.ts`:

```typescript
import prisma from "@/lib/prisma";
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
  householdId: number,
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
  adapterIds: number[],
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
  },
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
  householdId: number,
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
```

**Step 2: Create the adapter runner**

Create `src/adapters/runner.ts`:

```typescript
import logger from "@/lib/logger";
import { getAdapterModule } from "./modules";
import { saveAttachment } from "./file-storage";
import { createExpense } from "@/services/expense";
import { updateRunLogStatus, updateRunStatus } from "@/services/adapter-run";
import {
  AdapterRunStatus,
  AdapterRunLogStatus,
  ExpenseSource,
} from "@/types/finances";
import type { AdapterRunWithLogs } from "@/types/finances";
import type { AdapterContext } from "./types";

const log = logger.child({ module: "adapters/runner" });

export async function executeAdapterRun(
  run: AdapterRunWithLogs,
  budgetId: number,
  householdId: number,
  year: number,
  month: number,
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
            result.expense.attachment.data,
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
        "Adapter completed successfully",
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
```

**Step 3: Update `createExpense` service to accept `attachmentPath`**

In `src/services/expense.ts`, the `createExpense` function takes a `data` parameter validated by Zod. The schema needs to accept `attachmentPath`. However, since `attachmentPath` is set by the runner (not by the user), it should be passed directly. Modify `createExpense` to accept an optional `attachmentPath`:

In `src/services/expense.ts`, update the `createExpense` function's data parameter type and the Prisma create call to include `attachmentPath`:

```typescript
// Add attachmentPath to the data parameter (extend the schema input)
export async function createExpense(
  budgetId: number,
  householdId: number,
  data: z.infer<typeof createExpenseSchema> & { attachmentPath?: string | null },
): Promise<SerializedExpenseEntry | null> {
```

And in the `prisma.expenseEntry.create` call, add:

```typescript
  attachmentPath: data.attachmentPath ?? null,
```

**Step 4: Run lint + typecheck**

```bash
pnpm exec prettier --write src/services/adapter-run.ts src/adapters/runner.ts src/services/expense.ts
pnpm lint:fix
pnpm exec tsc --noEmit
```

**Step 5: Commit**

```bash
git add src/services/adapter-run.ts src/adapters/runner.ts src/services/expense.ts
git commit -m "Add adapter run service and async runner"
```

---

## Task 7: Server Actions — Adapter CRUD

**Files:**
- Create: `src/actions/adapter.ts`

**Step 1: Create adapter CRUD actions**

Create `src/actions/adapter.ts`:

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { resolveSessionAndHousehold, type ActionResult } from "@/actions/_helpers";
import { createAdapterSchema, updateAdapterSchema } from "@/lib/schemas/finances";
import {
  createAdapter,
  updateAdapter,
  deleteAdapter,
  toggleAdapterActive,
} from "@/services/adapter";
import { serializeError } from "@/lib/errors";
import logger from "@/lib/logger";
import type { SerializedAdapter } from "@/types/finances";

const log = logger.child({ module: "actions/adapter" });

export async function createAdapterAction(
  data: unknown,
): Promise<ActionResult<SerializedAdapter>> {
  try {
    const ctx = await resolveSessionAndHousehold();
    if ("error" in ctx) return { success: false, error: ctx.error };

    const parsed = createAdapterSchema.safeParse(data);
    if (!parsed.success) return { success: false, error: "Dados inválidos" };

    const adapter = await createAdapter(ctx.householdId, parsed.data);

    revalidatePath("/finances/adapters");
    return { success: true, data: adapter };
  } catch (error) {
    log.error({ error: serializeError(error) }, "Failed to create adapter");
    return { success: false, error: "Erro ao criar adaptador" };
  }
}

export async function updateAdapterAction(
  id: number,
  data: unknown,
): Promise<ActionResult<SerializedAdapter>> {
  try {
    const ctx = await resolveSessionAndHousehold();
    if ("error" in ctx) return { success: false, error: ctx.error };

    const parsed = updateAdapterSchema.safeParse(data);
    if (!parsed.success) return { success: false, error: "Dados inválidos" };

    const adapter = await updateAdapter(id, ctx.householdId, parsed.data);
    if (!adapter) return { success: false, error: "Adaptador não encontrado" };

    revalidatePath("/finances/adapters");
    return { success: true, data: adapter };
  } catch (error) {
    log.error({ error: serializeError(error) }, "Failed to update adapter");
    return { success: false, error: "Erro ao atualizar adaptador" };
  }
}

export async function deleteAdapterAction(
  id: number,
): Promise<ActionResult> {
  try {
    const ctx = await resolveSessionAndHousehold();
    if ("error" in ctx) return { success: false, error: ctx.error };

    const result = await deleteAdapter(id, ctx.householdId);
    if (!result.success) return { success: false, error: result.error };

    revalidatePath("/finances/adapters");
    return { success: true };
  } catch (error) {
    log.error({ error: serializeError(error) }, "Failed to delete adapter");
    return { success: false, error: "Erro ao excluir adaptador" };
  }
}

export async function toggleAdapterActiveAction(
  id: number,
  isActive: boolean,
): Promise<ActionResult<SerializedAdapter>> {
  try {
    const ctx = await resolveSessionAndHousehold();
    if ("error" in ctx) return { success: false, error: ctx.error };

    const adapter = await toggleAdapterActive(id, ctx.householdId, isActive);
    if (!adapter) return { success: false, error: "Adaptador não encontrado" };

    revalidatePath("/finances/adapters");
    return { success: true, data: adapter };
  } catch (error) {
    log.error({ error: serializeError(error) }, "Failed to toggle adapter");
    return { success: false, error: "Erro ao alterar status do adaptador" };
  }
}
```

**Step 2: Run lint + typecheck**

```bash
pnpm exec prettier --write src/actions/adapter.ts
pnpm lint:fix
pnpm exec tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/actions/adapter.ts
git commit -m "Add adapter CRUD server actions"
```

---

## Task 8: API Route — Trigger Adapter Run

**Files:**
- Create: `src/app/api/adapters/run/route.ts`
- Create: `src/actions/adapter-run.ts`

**Step 1: Create adapter run actions**

Create `src/actions/adapter-run.ts`:

```typescript
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
import { serializeError } from "@/lib/errors";
import logger from "@/lib/logger";
import prisma from "@/lib/prisma";
import type { AdapterRunWithLogs } from "@/types/finances";

const log = logger.child({ module: "actions/adapter-run" });

export async function triggerAdapterRunAction(
  budgetId: number,
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
      activeAdapters.map((a) => a.id),
    );

    // Fire and forget — run adapters asynchronously
    executeAdapterRun(run, budgetId, ctx.householdId, budget.year, budget.month).then(() => {
      // Revalidate after async completion
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

export async function retryAdapterLogAction(
  logId: number,
): Promise<ActionResult> {
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
              result.expense.attachment.data,
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
```

**Step 2: Run lint + typecheck**

```bash
pnpm exec prettier --write src/actions/adapter-run.ts
pnpm lint:fix
pnpm exec tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/actions/adapter-run.ts
git commit -m "Add adapter run trigger and retry server actions"
```

---

## Task 9: Sidebar Navigation Update

**Files:**
- Modify: `src/components/dashboard/app-sidebar.tsx`

**Step 1: Add Adapters link to sidebar navigation**

In the sidebar nav items array, add to the Finances section's `items` array, after the "Categories" entry:

```typescript
{ title: "Adapters", url: "/finances/adapters", icon: Plug },
```

Import `Plug` from `lucide-react` at the top of the file.

**Step 2: Run lint + typecheck**

```bash
pnpm exec prettier --write src/components/dashboard/app-sidebar.tsx
pnpm lint:fix
pnpm exec tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/components/dashboard/app-sidebar.tsx
git commit -m "Add adapters link to sidebar navigation"
```

---

## Task 10: Adapters List Page

**Files:**
- Create: `src/app/(dashboard)/finances/adapters/page.tsx`
- Create: `src/components/adapters/adapter-list.tsx`
- Create: `src/components/adapters/adapter-form-dialog.tsx`

**Step 1: Create the adapters list page (Server Component)**

Create `src/app/(dashboard)/finances/adapters/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getHouseholdByUserId } from "@/services/household";
import { getAdapters } from "@/services/adapter";
import { getAdapterRuns } from "@/services/adapter-run";
import { getAvailableModules } from "@/adapters/modules";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { AdapterList } from "@/components/adapters/adapter-list";

export default async function AdaptersPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const household = await getHouseholdByUserId(session.user.id);
  if (!household) redirect("/finances");

  const [adapters, runs] = await Promise.all([
    getAdapters(household.id),
    getAdapterRuns(household.id),
  ]);

  const availableModules = getAvailableModules();

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Adaptadores</h1>
      </div>
      <AdapterList
        adapters={adapters}
        runs={runs}
        availableModules={availableModules}
      />
    </div>
  );
}
```

**Step 2: Create the AdapterList client component**

Create `src/components/adapters/adapter-list.tsx`. This component should:

- Show a list of adapters as cards (mobile-first design using the existing card patterns)
- Each card shows: name, module label, active/inactive badge, last run status
- Toggle active/inactive via switch
- Delete button with confirmation
- "New Adapter" button that opens the form dialog
- Run history section below the adapter list
- Each run shows: date, month, status badge, expandable log entries
- Log entries show: adapter name, status, error message, retry button

Follow the existing component patterns from `src/components/purchases/` and `src/components/groceries/` for card layouts, dialogs, and responsive design. Use shadcn/ui `Card`, `Badge`, `Button`, `Switch`, `Dialog`, `Collapsible` components.

**Step 3: Create the AdapterFormDialog client component**

Create `src/components/adapters/adapter-form-dialog.tsx`. This component should:

- Dialog with form for creating/editing an adapter
- Fields: name (text input), description (textarea), moduleKey (select dropdown)
- The moduleKey select is populated from `availableModules` prop
- Uses `react-hook-form` + `zod` with `createAdapterSchema`/`updateAdapterSchema`
- Calls `createAdapterAction` or `updateAdapterAction`
- Shows toast on success/error

Follow the existing form patterns from `src/components/purchases/purchase-form.tsx` for form layout, Field component usage, and dialog structure.

**Step 4: Run lint + typecheck**

```bash
pnpm exec prettier --write src/app/\(dashboard\)/finances/adapters/ src/components/adapters/
pnpm lint:fix
pnpm exec tsc --noEmit
```

**Step 5: Commit**

```bash
git add src/app/\(dashboard\)/finances/adapters/ src/components/adapters/
git commit -m "Add adapters management page with list and form"
```

---

## Task 11: Run Adapters Button on Main Finances Page

**Files:**
- Create: `src/components/adapters/run-adapters-button.tsx`
- Modify: `src/app/(dashboard)/finances/page.tsx`

**Step 1: Create RunAdaptersButton component**

Create `src/components/adapters/run-adapters-button.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Play, Loader2 } from "lucide-react";
import { triggerAdapterRunAction } from "@/actions/adapter-run";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface RunAdaptersButtonProps {
  budgetId: number;
  disabled?: boolean;
}

export function RunAdaptersButton({ budgetId, disabled }: RunAdaptersButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleRun() {
    setLoading(true);
    try {
      const result = await triggerAdapterRunAction(budgetId);
      if (result.success) {
        toast.success("Adaptadores iniciados! Verifique o progresso na página de adaptadores.");
        router.refresh();
      } else {
        toast.error(result.error ?? "Erro ao iniciar adaptadores");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRun}
      disabled={disabled || loading}
    >
      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
      Executar Adaptadores
    </Button>
  );
}
```

**Step 2: Add RunAdaptersButton to the finances page**

In `src/app/(dashboard)/finances/page.tsx`, import and add the `RunAdaptersButton` next to the existing `PopulateRecurringButton`. Pass `budgetId={budget.id}` and `disabled={budget.status === "closed"}`.

**Step 3: Run lint + typecheck**

```bash
pnpm exec prettier --write src/components/adapters/run-adapters-button.tsx src/app/\(dashboard\)/finances/page.tsx
pnpm lint:fix
pnpm exec tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/components/adapters/run-adapters-button.tsx src/app/\(dashboard\)/finances/page.tsx
git commit -m "Add 'Run Adapters' button to main finances page"
```

---

## Task 12: Expense Attachment Viewer

**Files:**
- Create: `src/components/adapters/attachment-viewer.tsx`
- Modify: expense list/card component to show attachment indicator

**Step 1: Create AttachmentViewer Server Component**

Create `src/components/adapters/attachment-viewer.tsx`:

```tsx
import fs from "node:fs/promises";
import { getMimeType } from "@/adapters/file-storage";

interface AttachmentViewerProps {
  filePath: string;
}

export async function AttachmentViewer({ filePath }: AttachmentViewerProps) {
  let fileData: Buffer;
  try {
    fileData = await fs.readFile(filePath);
  } catch {
    return <p className="text-sm text-muted-foreground">Arquivo não encontrado</p>;
  }

  const mimeType = getMimeType(filePath);
  const base64 = fileData.toString("base64");
  const dataUrl = `data:${mimeType};base64,${base64}`;

  if (mimeType === "application/pdf") {
    return (
      <iframe
        src={dataUrl}
        className="h-[70vh] w-full rounded-md border"
        title="Anexo"
      />
    );
  }

  if (mimeType.startsWith("image/")) {
    /* Using <img> because the source is a base64 data URL from local files,
       which is not supported by next/image */
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={dataUrl}
        alt="Anexo"
        className="max-h-[70vh] w-full rounded-md object-contain"
      />
    );
  }

  return <p className="text-sm text-muted-foreground">Tipo de arquivo não suportado para preview</p>;
}
```

**Step 2: Add attachment indicator to expense display**

In the expense list/card component (likely `src/components/purchases/` or wherever expenses are rendered in the finances page), add a `Paperclip` icon next to expenses that have a non-null `attachmentPath`. Clicking it opens a dialog/sheet that renders `<AttachmentViewer filePath={expense.attachmentPath} />`.

Since `AttachmentViewer` is a Server Component and the expense list is likely a Client Component, you'll need to either:
- Use a separate page/route for viewing (`/finances/attachment/[expenseId]`)
- Or wrap in a Suspense boundary using a pattern where the dialog content is server-rendered

The simplest approach: create a small page at `src/app/(dashboard)/finances/attachment/[id]/page.tsx` that renders the attachment viewer for a given expense ID (after auth check). The expense card links to this page (opens in new tab or dialog).

**Step 3: Create attachment viewer page**

Create `src/app/(dashboard)/finances/attachment/[id]/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getHouseholdByUserId } from "@/services/household";
import prisma from "@/lib/prisma";
import { AttachmentViewer } from "@/components/adapters/attachment-viewer";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function AttachmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const household = await getHouseholdByUserId(session.user.id);
  if (!household) redirect("/finances");

  const expense = await prisma.expenseEntry.findFirst({
    where: {
      id: parseInt(id, 10),
      monthlyBudget: { householdId: household.id },
    },
    include: { monthlyBudget: true },
  });

  if (!expense?.attachmentPath) redirect("/finances");

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/finances?year=${expense.monthlyBudget.year}&month=${expense.monthlyBudget.month}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-lg font-semibold">{expense.description}</h1>
      </div>
      <AttachmentViewer filePath={expense.attachmentPath} />
    </div>
  );
}
```

**Step 4: Run lint + typecheck**

```bash
pnpm exec prettier --write src/components/adapters/attachment-viewer.tsx src/app/\(dashboard\)/finances/attachment/
pnpm lint:fix
pnpm exec tsc --noEmit
```

**Step 5: Commit**

```bash
git add src/components/adapters/attachment-viewer.tsx src/app/\(dashboard\)/finances/attachment/
git commit -m "Add attachment viewer for expenses with adapter attachments"
```

---

## Task 13: Google Service Account Client

**Files:**
- Create: `src/lib/google.ts`

**Step 1: Install googleapis package**

```bash
pnpm add googleapis
```

**Step 2: Create Google client utility**

Create `src/lib/google.ts`:

```typescript
import { google } from "googleapis";
import logger from "@/lib/logger";

const log = logger.child({ module: "lib/google" });

function getAuthClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  const delegatedUser = process.env.GOOGLE_DELEGATED_USER_EMAIL;

  if (!email || !key) {
    throw new Error("Google service account credentials not configured");
  }

  const auth = new google.auth.JWT({
    email,
    key: key.replace(/\\n/g, "\n"),
    scopes: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/drive.readonly",
    ],
    subject: delegatedUser,
  });

  return auth;
}

export async function getGmailClient() {
  const auth = getAuthClient();
  return google.gmail({ version: "v1", auth });
}

export async function getDriveClient() {
  const auth = getAuthClient();
  return google.drive({ version: "v3", auth });
}
```

**Step 3: Add env vars to `.env.example`**

Append to `.env.example`:

```
# Google Service Account (for finance adapters)
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=
GOOGLE_DELEGATED_USER_EMAIL=
```

**Step 4: Run lint + typecheck**

```bash
pnpm exec prettier --write src/lib/google.ts
pnpm lint:fix
pnpm exec tsc --noEmit
```

**Step 5: Commit**

```bash
git add src/lib/google.ts .env.example
git commit -m "Add Google service account client for Gmail/Drive access"
```

---

## Task 14: Verification + Final Checks

**Step 1: Run full development loop**

```bash
pnpm exec prettier --write .
pnpm lint:fix
pnpm exec tsc --noEmit
```

**Step 2: Verify the build compiles**

```bash
pnpm build
```

**Step 3: Verify database migration works**

```bash
pnpm exec prisma migrate dev
```

**Step 4: Manual smoke test**

1. Start dev server: `pnpm dev`
2. Navigate to `/finances/adapters` — should see empty adapter list
3. Create a new adapter using echo-test module
4. Navigate to `/finances` — should see "Run Adapters" button
5. Click "Run Adapters" — should create an adapter run
6. Navigate back to `/finances/adapters` — should see run with status
7. Check `/finances` — should see a test expense created by the echo adapter

**Step 5: Commit any final fixes**

```bash
git add -A
git commit -m "Final fixes for adapter system"
```

---

## Summary

| Task | Description | Key Files |
|------|-------------|-----------|
| 1 | Database schema + migration | `prisma/schema.prisma` |
| 2 | Types + Zod schemas | `src/types/finances.ts`, `src/lib/schemas/finances.ts` |
| 3 | Adapter interface + module registry | `src/adapters/types.ts`, `src/adapters/modules/` |
| 4 | File storage utility | `src/adapters/file-storage.ts` |
| 5 | Adapter CRUD service | `src/services/adapter.ts` |
| 6 | Adapter run service + runner | `src/services/adapter-run.ts`, `src/adapters/runner.ts` |
| 7 | Adapter CRUD server actions | `src/actions/adapter.ts` |
| 8 | Run trigger + retry actions | `src/actions/adapter-run.ts` |
| 9 | Sidebar navigation | `src/components/dashboard/app-sidebar.tsx` |
| 10 | Adapters management page + UI | `src/app/(dashboard)/finances/adapters/`, `src/components/adapters/` |
| 11 | Run Adapters button | `src/components/adapters/run-adapters-button.tsx` |
| 12 | Attachment viewer | `src/components/adapters/attachment-viewer.tsx` |
| 13 | Google service account client | `src/lib/google.ts` |
| 14 | Verification + smoke test | All files |
