# Finances Module Refactor — Design

**Date**: 2026-03-05
**Branch**: `feature/finances`

## Overview

Seven interconnected changes to the finances module: month lifecycle, adapter decoupling, recurring expense automation, on-demand adapter execution, and attachment UI.

## 1. Month Lifecycle Redesign

**Problem**: `getOrCreateMonthlyBudget()` auto-creates months on navigation, producing phantom future months.

**Solution**: Remove auto-creation. Months are created only by:
1. A "Create First Month" button when no months exist (first-time setup)
2. The close flow (closing month N creates month N+1)

Navigation to a non-existent month shows an empty state. Only the current open month is editable. Past closed months are read-only.

**Close flow pipeline**:
1. Validate `bankBalance` is set
2. Set `status = "closed"`, `closedAt = now`
3. Create next month (`status = "open"`)
4. Copy all active `RecurringExpense` templates into the new month
5. For recurring expenses with linked adapters, execute those adapters immediately
6. Return `{ closedBudget, newBudget, adapterResults }`

**Data cleanup migration**: Delete all `MonthlyBudget` rows where `year/month > current date` AND `status = "open"` (cascade deletes their expenses).

## 2. Adapter Interface Redesign (Action-Based)

Adapters become pure functions returning typed actions. The runner interprets and applies them.

```typescript
type AdapterAction =
  | { type: "create_expense"; data: { description: string; amount: number; categoryId: number; attachment?: { buffer: Buffer; filename: string } } }
  | { type: "update_expense"; expenseId: string; data: { amount?: number; description?: string; categoryId?: number } }
  | { type: "enrich_expense"; expenseId: string; attachment?: { buffer: Buffer; filename: string }; metadata?: Record<string, unknown> }

interface AdapterResult {
  success: boolean;
  error?: string;
  actions: AdapterAction[];
}

interface AdapterContext {
  householdId: string;
  budgetId: string;
  year: number;
  month: number;
  adapter: SerializedAdapter;
  targetExpenseId?: string;  // set when running for a specific recurring expense
}

interface AdapterModule {
  label: string;
  description: string;
  execute: (context: AdapterContext) => Promise<AdapterResult>;
}
```

**Runner changes**: Receives `AdapterAction[]` from each adapter. For each action, applies the operation (create/update/enrich) via the expense service. Logs results in `AdapterRunLog`.

**On-demand execution**: Replace "Run All Adapters" button with a dialog listing active adapters with checkboxes. User selects which to run.

## 3. Recurring Expenses + Adapter Linking

**Schema change**:
```prisma
model RecurringExpense {
  // ... existing fields ...
  adapterId  String?
  adapter    Adapter? @relation(fields: [adapterId], references: [id])
}
```

**UI**: Recurring expense form gets an optional "Adapter" dropdown.

**Flow on month close**:
1. Create `ExpenseEntry` from template (source: "recurring")
2. If `recurringExpense.adapterId` is set → execute linked adapter with `targetExpenseId` = new expense
3. Adapter returns actions (e.g., `update_expense` with real amount from Gmail bill, `enrich_expense` with PDF attachment)
4. Runner applies actions to the expense
5. If no adapter → expense uses template values as-is

## 4. Attachment Modal Redesign

**Current**: Route interception renders `AttachmentSheet` (side panel) — files appear too small.

**Change**: Replace `Sheet` with centered `Dialog`:
- Same route interception pattern (`@modal/(.)attachment/[id]`)
- `Dialog` component, near-fullscreen (`max-w-5xl`, `h-[85vh]`)
- PDF: `<iframe>` fills dialog body
- Images: centered, `object-contain`
- Close via top-right button or `router.back()`
- Full-page fallback route unchanged

**Files**: Rename `attachment-sheet.tsx` → `attachment-modal.tsx`, update intercepted page to use it.

## Summary of DB Changes

1. `RecurringExpense` gets optional `adapterId` foreign key
2. Migration to delete future open `MonthlyBudget` rows
3. `getOrCreateMonthlyBudget` → `getMonthlyBudget` (no auto-create)
