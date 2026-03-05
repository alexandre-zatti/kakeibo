# Finances Module Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor the finances module to fix month lifecycle, decouple adapters, automate recurring expenses on close, enable selective adapter execution, and improve attachment UI.

**Architecture:** Action-based adapter pattern where adapters return typed actions (create/update/enrich) instead of directly creating expenses. Month lifecycle moves from auto-create-on-navigate to explicit creation only via close flow. Attachment display changes from side sheet to centered modal.

**Tech Stack:** Next.js 15, Prisma, TypeScript, shadcn/ui Dialog component, existing adapter infrastructure.

---

### Task 1: Database Migration — Add `adapterId` to RecurringExpense + Delete Future Open Months

**Files:**
- Create: `prisma/migrations/YYYYMMDD_finances_refactor/migration.sql`
- Modify: `prisma/schema.prisma`

**Step 1: Update Prisma schema**

In `prisma/schema.prisma`, add the `adapterId` field and relation to `RecurringExpense`:

```prisma
model RecurringExpense {
  id          Int       @id @default(autoincrement())
  description String    @db.VarChar(255)
  amount      Decimal   @db.Decimal(12, 2)
  categoryId  Int
  householdId Int
  isActive    Boolean   @default(true)
  dayOfMonth  Int?
  adapterId   Int?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  category         Category       @relation(fields: [categoryId], references: [id])
  household        Household      @relation(fields: [householdId], references: [id])
  adapter          Adapter?       @relation(fields: [adapterId], references: [id], onDelete: SetNull)
  generatedExpenses ExpenseEntry[]

  @@schema("kakeibo")
}
```

Also add the reverse relation to `Adapter`:

```prisma
model Adapter {
  // ... existing fields ...
  recurringExpenses RecurringExpense[]
  // ... existing relations ...
}
```

**Step 2: Create and apply migration**

Run: `pnpm exec prisma migrate dev --name finances_refactor`

This creates the migration SQL. After it's created, manually add to the migration SQL the cleanup query:

```sql
-- Delete future open monthly budgets (and cascade their expenses)
DELETE FROM "kakeibo"."MonthlyBudget"
WHERE "status" = 'open'
AND ("year" > EXTRACT(YEAR FROM CURRENT_DATE)
  OR ("year" = EXTRACT(YEAR FROM CURRENT_DATE) AND "month" > EXTRACT(MONTH FROM CURRENT_DATE)));
```

**Step 3: Generate Prisma client**

Run: `pnpm exec prisma generate`

**Step 4: Verify types compile**

Run: `pnpm exec tsc --noEmit`

**Step 5: Commit**

```bash
git add prisma/
git commit -m "Add adapterId to RecurringExpense, delete future open months"
```

---

### Task 2: Redesign Adapter Types (Action-Based Interface)

**Files:**
- Modify: `src/adapters/types.ts`
- Modify: `src/types/finances.ts` (add SerializedRecurringExpense adapter field)

**Step 1: Rewrite adapter types**

Replace `src/adapters/types.ts` with:

```typescript
import type { SerializedAdapter } from "@/types/finances";

/** Actions an adapter can return for the runner to apply */
export type AdapterAction =
  | {
      type: "create_expense";
      data: {
        description: string;
        amount: number;
        categoryId: number;
        attachment?: { filename: string; mimeType: string; data: Buffer };
      };
    }
  | {
      type: "update_expense";
      expenseId: number;
      data: {
        amount?: number;
        description?: string;
        categoryId?: number;
        attachment?: { filename: string; mimeType: string; data: Buffer };
      };
    }
  | {
      type: "enrich_expense";
      expenseId: number;
      attachment?: { filename: string; mimeType: string; data: Buffer };
    };

export interface AdapterModule {
  label: string;
  description: string;
  execute: (context: AdapterContext) => Promise<AdapterResult>;
}

export interface AdapterContext {
  householdId: number;
  budgetId: number;
  year: number;
  month: number;
  adapter: SerializedAdapter;
  /** Set when running for a specific expense (e.g. recurring expense that was just populated) */
  targetExpenseId?: number;
}

export interface AdapterResult {
  success: boolean;
  error?: string;
  /** Actions to apply (empty array = success with no side effects) */
  actions: AdapterAction[];
}
```

**Step 2: Update SerializedRecurringExpense in types/finances.ts**

Add the optional adapter relation to the type. In `src/types/finances.ts`, update:

```typescript
export interface SerializedRecurringExpense extends Omit<RecurringExpense, "amount"> {
  amount: number;
  adapter?: SerializedAdapter | null;
}
```

**Step 3: Verify types compile**

Run: `pnpm exec tsc --noEmit`
Expected: Type errors in runner.ts, celesc-fatura.ts, condominio-fatura.ts, echo-test.ts (they use old `AdapterResult` shape). This is expected — we fix those in the next tasks.

**Step 4: Commit**

```bash
git add src/adapters/types.ts src/types/finances.ts
git commit -m "Redesign adapter types to action-based interface"
```

---

### Task 3: Migrate Existing Adapter Modules to New Interface

**Files:**
- Modify: `src/adapters/modules/celesc-fatura.ts`
- Modify: `src/adapters/modules/condominio-fatura.ts`
- Modify: `src/adapters/modules/echo-test.ts`

**Step 1: Update celesc-fatura.ts**

The key change: instead of returning `{ success: true, expense: {...} }`, return `{ success: true, actions: [{ type: "create_expense", data: {...} }] }`.

When `context.targetExpenseId` is set (called from recurring expense flow), return `update_expense` + `enrich_expense` actions instead of `create_expense`.

```typescript
// In the return block where bill was found:
const expenseData = {
  description,
  amount,
  categoryId: config.categoryId,
  attachment: { filename, mimeType: "application/pdf", data: bill.pdfBuffer },
};

if (context.targetExpenseId) {
  // Called from recurring expense flow — update existing expense
  return {
    success: true,
    actions: [
      {
        type: "update_expense",
        expenseId: context.targetExpenseId,
        data: { amount, description, attachment: expenseData.attachment },
      },
    ],
  };
}

return {
  success: true,
  actions: [{ type: "create_expense", data: expenseData }],
};
```

When no bill found, return `{ success: true, actions: [] }` (no-op).

**Step 2: Update condominio-fatura.ts** with the same pattern.

**Step 3: Update echo-test.ts** — return `actions: [{ type: "create_expense", data: {...} }]`.

**Step 4: Verify types compile**

Run: `pnpm exec tsc --noEmit`
Expected: Errors remain in `runner.ts` (next task). Adapter modules should be clean.

**Step 5: Commit**

```bash
git add src/adapters/modules/
git commit -m "Migrate adapter modules to action-based result interface"
```

---

### Task 4: Refactor Adapter Runner to Handle Actions

**Files:**
- Modify: `src/adapters/runner.ts`
- Modify: `src/services/expense.ts` (add `updateExpenseInternal` for runner use)

**Step 1: Add internal expense update function**

In `src/services/expense.ts`, add a function the runner can call to update an expense (bypassing the normal action flow). Check for an existing `updateExpense` function — if it exists, we can reuse it. If not, add:

```typescript
export async function updateExpenseFromAdapter(
  expenseId: number,
  householdId: number,
  data: { amount?: number; description?: string; categoryId?: number; attachmentPath?: string | null }
): Promise<void> {
  await prisma.expenseEntry.update({
    where: { id: expenseId, monthlyBudget: { householdId } },
    data,
  });
}

export async function enrichExpenseAttachment(
  expenseId: number,
  householdId: number,
  attachmentPath: string
): Promise<void> {
  await prisma.expenseEntry.update({
    where: { id: expenseId, monthlyBudget: { householdId } },
    data: { attachmentPath },
  });
}
```

**Step 2: Rewrite runner.ts to process actions**

Replace the result-handling logic. Instead of `if (result.expense) { ... }`, iterate `result.actions`:

```typescript
for (const action of result.actions) {
  switch (action.type) {
    case "create_expense": {
      let attachmentPath: string | undefined;
      if (action.data.attachment) {
        attachmentPath = await saveAttachment(
          householdId, year, month, runLog.adapter.id,
          action.data.attachment.filename, action.data.attachment.data
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
      let attachmentPath: string | undefined;
      if (action.data.attachment) {
        attachmentPath = await saveAttachment(
          householdId, year, month, runLog.adapter.id,
          action.data.attachment.filename, action.data.attachment.data
        );
      }
      await updateExpenseFromAdapter(action.expenseId, householdId, {
        ...action.data,
        attachment: undefined, // remove Buffer from prisma data
        attachmentPath: attachmentPath ?? undefined,
      });
      expenseEntryId = action.expenseId;
      break;
    }
    case "enrich_expense": {
      if (action.attachment) {
        const attachmentPath = await saveAttachment(
          householdId, year, month, runLog.adapter.id,
          action.attachment.filename, action.attachment.data
        );
        await enrichExpenseAttachment(action.expenseId, householdId, attachmentPath);
      }
      expenseEntryId = action.expenseId;
      break;
    }
  }
}
```

**Step 3: Update retry logic in `src/actions/adapter-run.ts`**

The `retryAdapterLogAction` has inline result-handling code that duplicates the runner. Refactor to reuse the runner's action-processing. Extract a shared `processAdapterActions` function from the runner, or simplify the retry to re-run through the runner.

**Step 4: Verify types compile**

Run: `pnpm exec tsc --noEmit`
Expected: PASS — all adapter code should now use the new interface.

**Step 5: Commit**

```bash
git add src/adapters/runner.ts src/services/expense.ts src/actions/adapter-run.ts
git commit -m "Refactor adapter runner to process action-based results"
```

---

### Task 5: Month Lifecycle — Remove Auto-Create, Add Empty State

**Files:**
- Modify: `src/services/monthly-budget.ts` (rename `getOrCreateMonthlyBudget` → keep as get-only)
- Modify: `src/app/(dashboard)/finances/page.tsx` (handle null budget)
- Create: `src/components/finances/empty-month.tsx` (empty state component)

**Step 1: Add get-only function to monthly-budget service**

In `src/services/monthly-budget.ts`, add a new function that only reads (no create):

```typescript
export async function getMonthlyBudget(
  householdId: number,
  year: number,
  month: number
): Promise<MonthlyBudgetDetail | null> {
  const budget = await prisma.monthlyBudget.findUnique({
    where: { householdId_year_month: { householdId, year, month } },
    include: budgetInclude,
  });

  if (!budget) return null;

  const serialized = serializeBudget(budget);
  const incomeEntries = serializeIncomeEntries(budget.incomeEntries);
  const expenseEntries = serializeExpenseEntries(budget.expenseEntries);
  const summary = computeSummary(serialized, incomeEntries, expenseEntries);

  return { ...summary, incomeEntries, expenseEntries };
}
```

Keep `getOrCreateMonthlyBudget` for now (used by close flow to create the next month), but the finances page will call `getMonthlyBudget` instead.

**Step 2: Add `createMonthlyBudget` function**

For the "Create First Month" button:

```typescript
export async function createMonthlyBudget(
  householdId: number,
  year: number,
  month: number
): Promise<MonthlyBudgetDetail> {
  const budget = await prisma.monthlyBudget.create({
    data: { householdId, year, month },
    include: budgetInclude,
  });

  const serialized = serializeBudget(budget);
  const incomeEntries = serializeIncomeEntries(budget.incomeEntries);
  const expenseEntries = serializeExpenseEntries(budget.expenseEntries);
  const summary = computeSummary(serialized, incomeEntries, expenseEntries);

  return { ...summary, incomeEntries, expenseEntries };
}
```

**Step 3: Add server action for creating a month**

In `src/actions/month-closing.ts` (or a new monthly-budget actions file), add:

```typescript
export async function createMonthAction(year: number, month: number): Promise<ActionResult> {
  const ctx = await resolveSessionAndHousehold();
  if ("error" in ctx) return { success: false, error: ctx.error };

  // Check no budget already exists
  const existing = await getMonthlyBudget(ctx.householdId, year, month);
  if (existing) return { success: false, error: "Mês já existe" };

  await createMonthlyBudget(ctx.householdId, year, month);
  revalidatePath("/finances");
  return { success: true };
}
```

**Step 4: Create empty month component**

Create `src/components/finances/empty-month.tsx`:

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { CalendarPlus } from "lucide-react";
import { createMonthAction } from "@/actions/month-closing";
import { toast } from "sonner";
import { useState } from "react";

interface EmptyMonthProps {
  year: number;
  month: number;
}

const MONTH_NAMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

export function EmptyMonth({ year, month }: EmptyMonthProps) {
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    setLoading(true);
    const result = await createMonthAction(year, month);
    if (!result.success) toast.error(result.error);
    setLoading(false);
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <p className="text-muted-foreground">
        Nenhum orçamento para {MONTH_NAMES[month - 1]} de {year}.
      </p>
      <Button onClick={handleCreate} disabled={loading}>
        <CalendarPlus className="mr-2 h-4 w-4" />
        Criar Mês
      </Button>
    </div>
  );
}
```

**Step 5: Update finances page to handle null budget**

In `src/app/(dashboard)/finances/page.tsx`, replace `getOrCreateMonthlyBudget` with `getMonthlyBudget`. If null, render `<EmptyMonth year={year} month={month} />` instead of the budget content.

```tsx
const budget = await getMonthlyBudget(householdId, year, month);

if (!budget) {
  return (
    <>
      <MonthNavigator year={year} month={month} status={null} />
      <EmptyMonth year={year} month={month} />
    </>
  );
}
// ... rest of existing render
```

The `MonthNavigator` needs a small update to accept `status: string | null` (null = no budget for this month).

**Step 6: Run dev checks**

```bash
pnpm exec prettier --write .
pnpm lint:fix
pnpm exec tsc --noEmit
```

**Step 7: Commit**

```bash
git add src/services/monthly-budget.ts src/app/\(dashboard\)/finances/page.tsx src/components/finances/empty-month.tsx src/actions/month-closing.ts
git commit -m "Remove auto-create month on navigate, add empty state"
```

---

### Task 6: Close Month Pipeline — Auto-Populate Recurring + Execute Linked Adapters

**Files:**
- Modify: `src/services/monthly-budget.ts` (`closeMonth` function)
- Modify: `src/services/monthly-budget.ts` (`populateFromRecurring` — return created expense IDs)
- Modify: `src/adapters/runner.ts` (export a function to run a single adapter for a target expense)

**Step 1: Update `populateFromRecurring` to return created expenses with their recurring expense data**

Change the return type to include created expense IDs and their linked `recurringExpenseId`:

```typescript
export async function populateFromRecurring(
  budgetId: number,
  householdId: number
): Promise<{ count: number; createdExpenses: Array<{ id: number; recurringExpenseId: number }> }> {
  // ... same logic, but after createMany, fetch the created entries to get IDs:
  const created = await prisma.expenseEntry.findMany({
    where: {
      monthlyBudgetId: budgetId,
      recurringExpenseId: { in: toCreate.map((r) => r.id) },
    },
    select: { id: true, recurringExpenseId: true },
  });

  return { count: created.length, createdExpenses: created as Array<{ id: number; recurringExpenseId: number }> };
}
```

**Step 2: Add `executeSingleAdapter` to runner**

In `src/adapters/runner.ts`, extract the per-adapter execution logic into a reusable function:

```typescript
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
```

Also extract the action-processing logic into `processAdapterActions`:

```typescript
export async function processAdapterActions(
  actions: AdapterAction[],
  budgetId: number,
  householdId: number,
  year: number,
  month: number,
  adapterId: number
): Promise<{ expenseEntryId?: number; attachmentPath?: string }> {
  // ... the switch/case logic from executeAdapterRun
}
```

**Step 3: Update `closeMonth` to auto-populate and run linked adapters**

```typescript
export async function closeMonth(budgetId: number, householdId: number): Promise<{
  closedBudget: SerializedMonthlyBudget;
  newBudgetId: number;
  recurringCount: number;
  adapterResults: Array<{ adapterId: number; success: boolean; error?: string }>;
} | null> {
  // ... existing validation ...

  const updated = await prisma.$transaction(async (tx) => {
    const closed = await tx.monthlyBudget.update({
      where: { id: budgetId },
      data: { status: "closed", closedAt: new Date() },
    });

    const nextMonth = budget.month === 12 ? 1 : budget.month + 1;
    const nextYear = budget.month === 12 ? budget.year + 1 : budget.year;

    const newBudget = await tx.monthlyBudget.upsert({
      where: { householdId_year_month: { householdId, year: nextYear, month: nextMonth } },
      create: { householdId, year: nextYear, month: nextMonth },
      update: {},
    });

    return { closed, newBudget, nextYear, nextMonth };
  });

  // After transaction: populate recurring expenses
  const { count, createdExpenses } = await populateFromRecurring(updated.newBudget.id, householdId);

  // Run linked adapters for recurring expenses that have an adapterId
  const recurringWithAdapters = await prisma.recurringExpense.findMany({
    where: {
      householdId,
      isActive: true,
      adapterId: { not: null },
    },
    include: { adapter: true },
  });

  const adapterResults = [];
  for (const recurring of recurringWithAdapters) {
    const expense = createdExpenses.find((e) => e.recurringExpenseId === recurring.id);
    if (!expense || !recurring.adapter) continue;

    const result = await executeSingleAdapter(recurring.adapter, {
      householdId,
      budgetId: updated.newBudget.id,
      year: updated.nextYear,
      month: updated.nextMonth,
      adapter: recurring.adapter,
      targetExpenseId: expense.id,
    });

    if (result.success && result.actions.length > 0) {
      await processAdapterActions(
        result.actions, updated.newBudget.id, householdId,
        updated.nextYear, updated.nextMonth, recurring.adapter.id
      );
    }

    adapterResults.push({
      adapterId: recurring.adapter.id,
      success: result.success,
      error: result.error,
    });
  }

  return {
    closedBudget: serializeBudget(updated.closed) as SerializedMonthlyBudget,
    newBudgetId: updated.newBudget.id,
    recurringCount: count,
    adapterResults,
  };
}
```

**Step 4: Update closeMonthAction to handle new return type**

In `src/actions/month-closing.ts`, update the close action to pass through the new return shape and show results to the user.

**Step 5: Update the MonthClosingWizard component**

The wizard's final step should display a summary of what happened: how many recurring expenses were populated, which adapters ran, any errors.

**Step 6: Remove PopulateRecurringButton from finances page**

Since recurring expenses are now auto-populated on close, the manual "Populate Recurring" button is no longer needed on the main finances page. Remove it from the page and optionally from the component file.

**Step 7: Run dev checks**

```bash
pnpm exec prettier --write .
pnpm lint:fix
pnpm exec tsc --noEmit
```

**Step 8: Commit**

```bash
git add src/services/monthly-budget.ts src/adapters/runner.ts src/actions/month-closing.ts src/components/finances/
git commit -m "Auto-populate recurring and run linked adapters on month close"
```

---

### Task 7: On-Demand Adapter Execution — Select Which Adapters to Run

**Files:**
- Modify: `src/actions/adapter-run.ts` (`triggerAdapterRunAction` — accept optional adapter IDs)
- Modify: `src/components/adapters/run-adapters-button.tsx` → rewrite as `RunAdaptersDialog`

**Step 1: Update triggerAdapterRunAction to accept adapter IDs**

```typescript
export async function triggerAdapterRunAction(
  budgetId: number,
  adapterIds?: number[] // if undefined, run all active
): Promise<ActionResult<{ runId: number }>> {
  // ... existing validation ...
  const adapters = await getAdapters(ctx.householdId);
  const toRun = adapterIds
    ? adapters.filter((a) => adapterIds.includes(a.id) && a.isActive)
    : adapters.filter((a) => a.isActive);

  if (toRun.length === 0) {
    return { success: false, error: "Nenhum adaptador selecionado" };
  }

  const run = await createAdapterRun(ctx.householdId, budgetId, toRun.map((a) => a.id));
  // ... fire and forget ...
}
```

**Step 2: Install shadcn Dialog component**

Run: `pnpm dlx shadcn@latest add dialog`

**Step 3: Rewrite RunAdaptersButton as RunAdaptersDialog**

Create `src/components/adapters/run-adapters-dialog.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Play, Loader2 } from "lucide-react";
import { triggerAdapterRunAction } from "@/actions/adapter-run";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { AdapterWithLastRun } from "@/types/finances";

interface RunAdaptersDialogProps {
  budgetId: number;
  adapters: AdapterWithLastRun[];
  disabled?: boolean;
}

export function RunAdaptersDialog({ budgetId, adapters, disabled }: RunAdaptersDialogProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const activeAdapters = adapters.filter((a) => a.isActive);

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (isOpen) setSelected(activeAdapters.map((a) => a.id)); // select all by default
  }

  function toggleAdapter(id: number) {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  async function handleRun() {
    setLoading(true);
    const result = await triggerAdapterRunAction(budgetId, selected);
    if (result.success) {
      toast.success("Adaptadores iniciados!");
      router.refresh();
      setOpen(false);
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} disabled={disabled || activeAdapters.length === 0}>
        <Play className="mr-2 h-4 w-4" />
        Executar Adaptadores
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Executar Adaptadores</DialogTitle>
            <DialogDescription>Selecione quais adaptadores executar neste mês.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {activeAdapters.map((adapter) => (
              <label key={adapter.id} className="flex items-center gap-3 cursor-pointer">
                <Checkbox
                  checked={selected.includes(adapter.id)}
                  onCheckedChange={() => toggleAdapter(adapter.id)}
                />
                <div>
                  <p className="text-sm font-medium">{adapter.name}</p>
                  {adapter.description && (
                    <p className="text-xs text-muted-foreground">{adapter.description}</p>
                  )}
                </div>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleRun} disabled={loading || selected.length === 0}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              Executar ({selected.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

**Step 4: Update finances page to pass adapters to RunAdaptersDialog**

Fetch adapters in the finances page and pass them as props. Replace `<RunAdaptersButton>` with `<RunAdaptersDialog>`.

**Step 5: Delete old `run-adapters-button.tsx`**

**Step 6: Check if `Checkbox` component exists, install if not**

Run: `pnpm dlx shadcn@latest add checkbox` (if not already present)

**Step 7: Run dev checks**

```bash
pnpm exec prettier --write .
pnpm lint:fix
pnpm exec tsc --noEmit
```

**Step 8: Commit**

```bash
git add src/actions/adapter-run.ts src/components/adapters/ src/app/\(dashboard\)/finances/page.tsx src/components/ui/
git commit -m "Add selective adapter execution dialog"
```

---

### Task 8: Recurring Expense Form — Add Adapter Dropdown

**Files:**
- Modify: `src/components/finances/recurring-expense-form-sheet.tsx`
- Modify: `src/lib/schemas/finances.ts` (add `adapterId` to schemas)
- Modify: `src/services/recurring-expense.ts` (include adapter in queries)
- Modify: `src/app/(dashboard)/finances/recurring/page.tsx` (pass adapters to list)
- Modify: `src/components/finances/recurring-expense-list.tsx` (pass adapters to form)

**Step 1: Update Zod schemas**

In `src/lib/schemas/finances.ts`, add `adapterId` to recurring expense schemas:

```typescript
export const createRecurringExpenseSchema = z.object({
  description: z.string().min(1, "Descrição é obrigatória").max(255),
  amount: z.number().positive("Valor deve ser positivo"),
  categoryId: z.number().int().positive("Categoria é obrigatória"),
  dayOfMonth: z.number().int().min(1).max(31).optional().nullable(),
  adapterId: z.number().int().positive().optional().nullable(),
});

export const updateRecurringExpenseSchema = z.object({
  description: z.string().min(1).max(255).optional(),
  amount: z.number().positive("Valor deve ser positivo").optional(),
  categoryId: z.number().int().positive().optional(),
  dayOfMonth: z.number().int().min(1).max(31).optional().nullable(),
  adapterId: z.number().int().positive().optional().nullable(),
});
```

**Step 2: Update recurring expense service**

In `src/services/recurring-expense.ts`, include `adapter` in queries:

```typescript
const recurringInclude = {
  category: true,
  adapter: true,
} as const;

export async function getRecurringExpenses(householdId: number) {
  const entries = await prisma.recurringExpense.findMany({
    where: { householdId },
    include: recurringInclude,
    orderBy: [{ isActive: "desc" }, { description: "asc" }],
  });
  return entries.map(serialize);
}
```

Also update create/update to handle `adapterId`:

```typescript
// In createRecurringExpense:
data: {
  ...data,
  householdId,
  dayOfMonth: data.dayOfMonth ?? null,
  adapterId: data.adapterId ?? null,
}

// In updateRecurringExpense:
data: {
  ...data,
  dayOfMonth: data.dayOfMonth ?? null,
  adapterId: data.adapterId ?? null,
}
```

**Step 3: Update recurring expense form**

In `src/components/finances/recurring-expense-form-sheet.tsx`, add an "Adapter" Select dropdown that lists available adapters:

```tsx
// Add to props:
interface RecurringExpenseFormSheetProps {
  categories: SerializedCategory[];
  adapters: SerializedAdapter[];  // NEW
  entry?: SerializedRecurringExpense | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Add to form schema:
adapterId: z.number().int().positive().optional().nullable(),

// Add to default values:
adapterId: entry?.adapterId ?? null,

// Add Select field after dayOfMonth:
<div className="space-y-2">
  <Label>Adaptador (opcional)</Label>
  <Select
    value={form.watch("adapterId")?.toString() || "none"}
    onValueChange={(v) => form.setValue("adapterId", v === "none" ? null : parseInt(v, 10))}
  >
    <SelectTrigger>
      <SelectValue placeholder="Nenhum" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="none">Nenhum</SelectItem>
      {adapters.map((a) => (
        <SelectItem key={a.id} value={a.id.toString()}>{a.name}</SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```

**Step 4: Update recurring page to fetch adapters**

In `src/app/(dashboard)/finances/recurring/page.tsx`, fetch adapters and pass to `RecurringExpenseList`:

```tsx
const [expenses, categories, adapters] = await Promise.all([
  getRecurringExpenses(household.id),
  getCategoriesByHousehold(household.id, "expense"),
  getAdapters(household.id),
]);

return <RecurringExpenseList expenses={expenses} categories={categories} adapters={adapters} />;
```

**Step 5: Update RecurringExpenseList to pass adapters to form**

```tsx
// Add to props:
adapters: SerializedAdapter[];

// Pass to form:
<RecurringExpenseFormSheet
  categories={categories}
  adapters={adapters}
  entry={editEntry}
  open={formOpen || !!editEntry}
  onOpenChange={...}
/>
```

**Step 6: Run dev checks**

```bash
pnpm exec prettier --write .
pnpm lint:fix
pnpm exec tsc --noEmit
```

**Step 7: Commit**

```bash
git add src/lib/schemas/finances.ts src/services/recurring-expense.ts src/components/finances/ src/app/\(dashboard\)/finances/recurring/
git commit -m "Add adapter dropdown to recurring expense form"
```

---

### Task 9: Attachment Modal — Sheet to Dialog

**Files:**
- Modify: `src/components/adapters/attachment-sheet.tsx` → rename/rewrite as `attachment-modal.tsx`
- Modify: `src/components/adapters/attachment-viewer.tsx` (adjust sizing)
- Modify: `src/app/(dashboard)/finances/@modal/(.)attachment/[id]/page.tsx` (use new modal)

**Step 1: Rewrite attachment component as a Dialog**

Create `src/components/adapters/attachment-modal.tsx` (or rename existing file):

```tsx
"use client";

import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface AttachmentModalProps {
  title: string;
  children: React.ReactNode;
}

export function AttachmentModal({ title, children }: AttachmentModalProps) {
  const router = useRouter();

  return (
    <Dialog open onOpenChange={() => router.back()}>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="truncate">{title}</DialogTitle>
          <DialogDescription>Visualização do anexo</DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Update AttachmentViewer sizing**

In `src/components/adapters/attachment-viewer.tsx`, change iframe/img height to fill parent:

```tsx
// PDF: change h-[70vh] to h-full
<iframe src={dataUrl} className="h-full w-full rounded-md border" title="Anexo" />

// Image: change max-h-[70vh] to h-full
<img src={dataUrl} alt="Anexo" className="h-full w-full rounded-md object-contain" />
```

**Step 3: Update intercepted route page**

In `src/app/(dashboard)/finances/@modal/(.)attachment/[id]/page.tsx`, replace `AttachmentSheet` with `AttachmentModal`:

```tsx
import { AttachmentModal } from "@/components/adapters/attachment-modal";

// In render:
return (
  <AttachmentModal title={expense.description}>
    <AttachmentViewer filePath={expense.attachmentPath} />
  </AttachmentModal>
);
```

**Step 4: Delete old attachment-sheet.tsx**

Remove `src/components/adapters/attachment-sheet.tsx`.

**Step 5: Run dev checks**

```bash
pnpm exec prettier --write .
pnpm lint:fix
pnpm exec tsc --noEmit
```

**Step 6: Commit**

```bash
git add src/components/adapters/ src/app/\(dashboard\)/finances/@modal/
git commit -m "Replace attachment side sheet with centered fullscreen modal"
```

---

### Task 10: Final Cleanup and Verification

**Files:**
- Various — check for dead imports, unused code

**Step 1: Search for remaining references to old code**

- `getOrCreateMonthlyBudget` — should only be used internally by `closeMonth` if at all (or replaced by direct prisma calls in the transaction). Remove from exports if unused externally.
- `PopulateRecurringButton` — should be removed from finances page (now auto-populated on close)
- `RunAdaptersButton` — replaced by `RunAdaptersDialog`
- `AttachmentSheet` — replaced by `AttachmentModal`

**Step 2: Run full dev loop**

```bash
pnpm exec prettier --write .
pnpm lint:fix
pnpm exec tsc --noEmit
pnpm build
```

**Step 3: Test manually**

- Navigate to a future month → should show empty state with "Criar Mês" button
- Navigate to current month → should show existing budget
- Close current month → should create next month, populate recurring, run linked adapters
- Go to recurring expenses → should be able to link an adapter
- Click attachment badge → should open centered modal, not side sheet
- Run adapters → should show selection dialog

**Step 4: Commit**

```bash
git add -A
git commit -m "Clean up dead code from finances refactor"
```
