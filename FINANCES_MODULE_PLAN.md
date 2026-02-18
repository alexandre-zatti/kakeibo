# Finances Module - Plan & Progress Tracker

> **How to use this file**: Each phase has a status badge. Update it as work progresses.
> Each phase is designed to be completed in a **separate session** to avoid context overload.
> After completing a phase, run the verification steps, then update the status below.
>
> Statuses: `PENDING` | `DOING` | `DONE`

---

## Progress Overview

| Phase | Description | Status | Session Notes |
|-------|-------------|--------|---------------|
| 1a | Database Schema + Migration | `DONE` | Branch: feature/finances-phase-1a |
| 1b | Types + Zod Schemas | `DONE` | |
| 1c | Services | `DONE` | |
| 1d | Server Actions | `DONE` | |
| 1e | Navigation + Middleware + Household UI | `DONE` | |
| 1f | Monthly Budget Page + Components | `DONE` | |
| 1g | Caixinhas Pages + Components | `DONE` | |
| 1h | Recurring Expenses Page + Components | `DONE` | |
| 1i | Month Closing Flow | `DONE` | |
| 1j | Dashboard Integration | `DONE` | |
| 1k | Categories Management Page | `DONE` | |
| 1.5 | Data Migration (Google Sheets) | `PENDING` | |
| 2 | Adapters (Gmail + Drive) | `PENDING` | Future |

### Dependency Graph

```
1a → 1b → 1c → 1d → 1e
                       ├→ 1f ──┐
                       ├→ 1g   ├→ 1i → 1j
                       ├→ 1h ──┘
                       └→ 1k
                                  → 1.5 (needs all of Phase 1)
                                     → 2 (future)
```

Phases 1f, 1g, 1h, 1k can run in parallel after 1e. Phase 1i needs both 1f and 1g. Phase 1.5 needs everything.

---

# Functional Description

## Why

You manage your household budget (shared with Mozi) in a Google Sheets spreadsheet. Each month you manually track income, expenses (paid/unpaid), and savings box contributions across multiple tabs. Bills arrive from scattered sources -- Gmail notifications, PDF invoices on Drive -- and you have to manually aggregate them before deciding what to pay. This module replaces that entire workflow with a unified app.

## What It Does

The finances module has **3 main areas**:

### 1. Monthly Budget

The core daily-use page -- equivalent to your spreadsheet's monthly tabs. One budget per month, shared between household members.

**What you see:**
- **Month navigator**: flip between months (prev/next arrows, "Fevereiro 2026"). Shows month status: **Open** (current/active) or **Closed** (finalized).
- **Summary bar**: 5 key numbers matching your spreadsheet formulas:
  - Total Entrada (total income)
  - Previsao Gastos (sum of all listed expenses)
  - Gastos Concretizados (sum of paid expenses)
  - Gastos a Pagar (expected - paid = what's still pending)
  - Total Disponivel (income - paid expenses - savings contributions = what's left)
- **Income section** (collapsible): list of income sources with amounts and **categories** (e.g., Salary R$1,700 [Salario], Freelance R$500 [Freelance]). Add/edit/delete.
- **Expenses list**: each expense shows description, amount, **category**, paid status, and **source tag**. The source tag tells you where the expense came from:
  - No tag = manually added
  - "Draft" tag = auto-detected by an adapter, awaiting your review
  - "Auto" tag = auto-approved from a trusted adapter source
  - Recurring badge = came from recurring templates

**Key behaviors:**
- When you open a new month for the first time, you can **populate from recurring** -- this copies your fixed monthly bills (Aluguel, Condominio, Luz, etc.) as pending expenses automatically
- Adapter-detected bills appear **directly in the expense list** as draft entries (not in a separate inbox). You review them inline -- approve, edit, or dismiss.
- **Trusted adapter sources** (same email sender, same PDF document pattern) get auto-approved: their detected bills skip the draft stage and land as regular pending expenses. If a source keeps appearing monthly, it's automatically suggested as a new recurring expense.
- Both you and Mozi can view and edit the same budget

**Categories:**
Both income and expenses have a **category** field. Categories are user-defined (you create them once, reuse across months). Examples:
- Income categories: Salario, Freelance, Rendimentos, Outros
- Expense categories: Moradia, Transporte, Alimentacao, Lazer, Pets, Seguros, Taxas

Categories enable future analytics -- "how much do we spend on Transporte per month?" -- but for Phase 1 they're just a label on each entry.

### 2. Month Closing Process

A month doesn't just end -- it gets **closed**. Closing is a mandatory step before you can start working on the next month. This ensures your app stays in sync with reality.

**The closing flow:**

1. **Reconcile**: You enter your actual bank account balance. The system compares it to the calculated "Total Disponivel". If there's a discrepancy, you resolve it (add a missing expense, adjust an amount, etc.) until the numbers match.

2. **Distribute remaining balance**: Any positive remaining balance must be allocated to savings boxes. The system shows you the remaining amount and lets you assign portions to each caixinha (e.g., R$300 to Ferias, R$100 to Casa, R$50 to Nenes). You keep distributing until the remaining balance hits **R$0.00**.

3. **Close**: Once the balance is zero, you confirm the close. The month becomes read-only (no more edits). Savings box contributions are recorded. The next month is auto-created and ready to populate.

**Why close at zero?** This creates a clean break between months. Every real (BRL) is accounted for -- either spent on an expense or moved to a savings box. No "floating" money that gets lost between months.

### 3. Caixinhas (Savings Boxes)

Your savings tracking system -- dedicated "boxes" for goals like pets (Nenes), house (Casa), vacation (Ferias), passport (Passaporte).

**What you see:**
- **Overview page**: grid of cards, each showing box name, current balance, monthly target, and goal progress bar
- **Total savings** displayed across all boxes
- **Detail page** (click a box): full contribution/withdrawal history with dates and notes

**How savings interact with the monthly budget:**
- In the monthly budget, you can create an expense linked to a savings box (e.g., "Ferias - R$600"). When paid, the contribution is auto-recorded.
- During **month closing**, remaining balance is distributed to savings boxes (the main way money enters the boxes).
- Direct contributions/withdrawals are also possible from the detail page (for things like interest earnings, one-off withdrawals for pet vet bills, etc.)

---

## User Flow (Monthly Cycle)

1. **Start of month**: Open `/finances`. If the previous month isn't closed yet, the system prompts you to close it first (reconcile + distribute). Once closed, the new month is created. Click "Populate from Recurring" to load fixed bills.
2. **Add income**: Enter your income sources with categories.
3. **Throughout the month**:
   - Adapters detect new bills from Gmail/Drive -> they appear **in the expense list** as drafts (or auto-approved if from trusted sources)
   - Review any draft expenses inline, approve or dismiss
   - As you pay bills IRL, toggle each expense to "PAGO"
   - Add one-off expenses manually (gasosa, pastel, etc.) with categories
4. **Check the summary** at any time: see how much you've spent, what's pending, what's available
5. **End of month -- Close**:
   - Reconcile: enter actual bank balance, fix any discrepancies
   - Distribute: allocate remaining balance to savings boxes until it hits R$0
   - Close: month becomes read-only, next month is created

---

## Shared Household

Both you and Mozi share the same budget:
- Either user can view, add, edit, or pay expenses
- Income, expenses, and savings are household-level, not per-person
- A one-time "Household Setup" flow creates the shared group and invites the other member

---

## Key Decisions

1. **No separate inbox** -- adapter-detected bills land directly in the monthly expense list as drafts, reviewed inline
2. **Trusted sources auto-approve** -- known email senders / PDF patterns skip the draft stage; recurring patterns auto-suggested as templates
3. **Mandatory month closing** -- reconcile with bank, distribute all remaining balance to caixinhas, close at R$0. Clean break between months.
4. **Categories on everything** -- income and expenses both have user-defined categories for future analytics/grouping
5. **Household model** for shared budget -- both users see the same data
6. **Savings contribution = single source of truth** -- box balance is always SUM of contributions
7. **Manual first, adapters second** -- core budget usable immediately; adapters enhance it later
8. **Recurring expenses as templates** -- user triggers "populate" for a new month, no cron jobs
9. **Portuguese labels for finance terms** (Pago/Pendente, Caixinhas, Aportes) matching your spreadsheet
10. **Month navigation via URL params** (`/finances?year=2026&month=2`)
11. **Full historical migration** -- all ~33 months + caixinhas history from Google Sheets. Income as single entry per month. AI auto-categorization for expenses via Gemini.

---

# Technical Implementation

## Phase 1a: Database Schema + Migration — `PENDING`

**Modify**: `prisma/schema.prisma`

### New Models

**Household**
- `id` Int PK autoincrement
- `createdAt` DateTime @default(now())
- `updatedAt` DateTime @updatedAt
- `name` VarChar(255)
- Relations: members[], categories[], monthlyBudgets[], savingsBoxes[], recurringExpenses[]

**HouseholdMember**
- `id` Int PK autoincrement
- `createdAt` DateTime @default(now())
- `householdId` Int FK -> Household (onDelete: Cascade)
- `userId` String FK -> User (onDelete: Cascade)
- `role` VarChar(50) default "owner" -- "owner" | "member"
- @@unique([householdId, userId])

**Category**
- `id` Int PK autoincrement
- `createdAt` DateTime @default(now())
- `updatedAt` DateTime @updatedAt
- `name` VarChar(255)
- `type` VarChar(20) -- "income" | "expense"
- `icon` VarChar(50) optional
- `color` VarChar(7) optional (hex)
- `sortOrder` Int default 0
- `householdId` Int FK -> Household (onDelete: Cascade)
- @@unique([householdId, name, type])
- Relations: incomeEntries[], expenseEntries[], recurringExpenses[]

**MonthlyBudget**
- `id` Int PK autoincrement
- `createdAt` DateTime @default(now())
- `updatedAt` DateTime @updatedAt
- `year` Int
- `month` Int (1-12)
- `status` VarChar(20) default "open" -- "open" | "closed"
- `closedAt` DateTime optional
- `bankBalance` Decimal(10,2) optional -- actual balance entered during reconciliation
- `householdId` Int FK -> Household (onDelete: Cascade)
- @@unique([householdId, year, month])
- Relations: incomeEntries[], expenseEntries[]

**IncomeEntry**
- `id` Int PK autoincrement
- `createdAt` DateTime @default(now())
- `updatedAt` DateTime @updatedAt
- `description` VarChar(255)
- `amount` Decimal(10,2)
- `categoryId` Int FK -> Category (onDelete: Restrict)
- `monthlyBudgetId` Int FK -> MonthlyBudget (onDelete: Cascade)

**ExpenseEntry**
- `id` Int PK autoincrement
- `createdAt` DateTime @default(now())
- `updatedAt` DateTime @updatedAt
- `description` VarChar(255)
- `amount` Decimal(10,2)
- `categoryId` Int FK -> Category (onDelete: Restrict)
- `monthlyBudgetId` Int FK -> MonthlyBudget (onDelete: Cascade)
- `isPaid` Boolean default false
- `paidAt` DateTime optional
- `source` VarChar(20) default "manual" -- "manual" | "draft" | "auto" | "recurring"
- `savingsBoxId` Int optional FK -> SavingsBox (onDelete: SetNull)
- `recurringExpenseId` Int optional FK -> RecurringExpense (onDelete: SetNull)

**RecurringExpense**
- `id` Int PK autoincrement
- `createdAt` DateTime @default(now())
- `updatedAt` DateTime @updatedAt
- `description` VarChar(255)
- `amount` Decimal(10,2)
- `categoryId` Int FK -> Category (onDelete: Restrict)
- `householdId` Int FK -> Household (onDelete: Cascade)
- `isActive` Boolean default true
- `dayOfMonth` Int optional (1-31, expected payment day)
- Relations: generatedExpenses[]

**SavingsBox**
- `id` Int PK autoincrement
- `createdAt` DateTime @default(now())
- `updatedAt` DateTime @updatedAt
- `name` VarChar(255)
- `balance` Decimal(10,2) default 0
- `monthlyTarget` Decimal(10,2) optional
- `goalAmount` Decimal(10,2) optional
- `icon` VarChar(50) optional
- `color` VarChar(7) optional
- `householdId` Int FK -> Household (onDelete: Cascade)
- Relations: transactions[], linkedExpenses[]

**SavingsTransaction**
- `id` Int PK autoincrement
- `createdAt` DateTime @default(now())
- `type` VarChar(20) -- "contribution" | "withdrawal"
- `amount` Decimal(10,2)
- `description` VarChar(255) optional
- `savingsBoxId` Int FK -> SavingsBox (onDelete: Cascade)
- `source` VarChar(20) default "manual" -- "manual" | "closing" | "expense_link"

**User model update**: add `householdMembers HouseholdMember[]` relation.

All models use `@@map("snake_case_table")`, `@@schema("kakeibo")`, and snake_case `@map()` on columns.

**Run**: `pnpm exec prisma migrate dev --name add_finances_module`

**Verify**: `pnpm exec tsc --noEmit` passes, migration applied successfully.

---

## Phase 1b: Types + Zod Schemas — `PENDING`

**Create**: `src/types/finances.ts`

Enums and config objects:
- `MonthlyBudgetStatus` { OPEN: "open", CLOSED: "closed" }
- `ExpenseSource` { MANUAL, DRAFT, AUTO, RECURRING } with `ExpenseSourceConfig` for UI labels/variants
- `CategoryType` { INCOME: "income", EXPENSE: "expense" }
- `SavingsTransactionType` { CONTRIBUTION, WITHDRAWAL }
- `SavingsTransactionSource` { MANUAL, CLOSING, EXPENSE_LINK }
- `HouseholdRole` { OWNER, MEMBER }

Serialized types (Decimal -> number):
- `SerializedCategory` (no Decimals, pass-through)
- `SerializedIncomeEntry` (amount: number)
- `SerializedExpenseEntry` (amount: number)
- `SerializedRecurringExpense` (amount: number)
- `SerializedSavingsBox` (balance, monthlyTarget, goalAmount: number|null)
- `SerializedSavingsTransaction` (amount: number)
- `SerializedMonthlyBudget` (bankBalance: number|null)

Composite types:
- `MonthlyBudgetSummary` extends SerializedMonthlyBudget + { totalIncome, totalExpensesForecast, totalExpensesPaid, totalExpensesUnpaid, totalAvailable }
- `MonthlyBudgetDetail` extends MonthlyBudgetSummary + { incomeEntries[], expenseEntries[] } (with joined category and savingsBox name)
- `SavingsBoxWithHistory` extends SerializedSavingsBox + { transactions[], goalProgress: number|null }
- `HouseholdWithMembers` extends Household + { members[] with user info }
- `MonthReference` { year: number, month: number }

**Create**: `src/lib/schemas/finances.ts`

Schemas:
- `createHouseholdSchema` { name: string min(1) max(255) }
- `inviteHouseholdMemberSchema` { email: string email() }
- `createCategorySchema` { name, type: enum("income","expense"), icon?, color?, sortOrder }
- `updateCategorySchema` (partial of create, omit type)
- `createIncomeSchema` { description, amount: positive, categoryId }
- `updateIncomeSchema` (partial)
- `createExpenseSchema` { description, amount: positive, categoryId, isPaid, source, savingsBoxId?, recurringExpenseId? }
- `updateExpenseSchema` (partial)
- `createRecurringExpenseSchema` { description, amount: positive, categoryId, dayOfMonth? }
- `updateRecurringExpenseSchema` (partial)
- `createSavingsBoxSchema` { name, monthlyTarget?, goalAmount?, icon?, color? }
- `updateSavingsBoxSchema` (partial)
- `createSavingsTransactionSchema` { type: enum, amount: positive, description?, source }
- `reconcileMonthSchema` { bankBalance: number min(0) }
- `distributeBalanceSchema` { allocations: array of { savingsBoxId, amount: positive } }
- `monthParamsSchema` { year: coerce int, month: coerce int 1-12 }

All export inferred types via `z.infer<>`.

**Verify**: `pnpm exec tsc --noEmit`

---

## Phase 1c: Services — `PENDING`

All services follow the existing pattern: child logger, Prisma queries, Decimal->Number serialization, ownership via householdId, return null for not found, throw on real errors.

**Create**: `src/services/household.ts`
- `getHouseholdByUserId(userId)` -> HouseholdWithMembers | null
- `createHousehold(userId, data)` -> HouseholdWithMembers (transaction: create household + member(role=owner) + seed default categories)
- `addHouseholdMember(householdId, email, requestingUserId)` -> HouseholdMember (owner-only)
- `removeHouseholdMember(householdId, memberId, requestingUserId)` -> boolean

**Create**: `src/services/category.ts`
- `getCategoriesByHousehold(householdId, type?)` -> SerializedCategory[]
- `createCategory(householdId, data)` -> SerializedCategory
- `updateCategory(categoryId, householdId, data)` -> SerializedCategory | null
- `deleteCategory(categoryId, householdId)` -> boolean (check not in use)
- `seedDefaultCategories(householdId)` -> void (income: Salario, Freelance, Rendimentos, Outros; expense: Moradia, Transporte, Alimentacao, Lazer, Pets, Seguros, Taxas)

**Create**: `src/services/monthly-budget.ts`
- `getOrCreateMonthlyBudget(householdId, year, month)` -> MonthlyBudgetDetail (upsert + compute summary)
- `getMonthlyBudgetSummary(householdId, year, month)` -> MonthlyBudgetSummary | null
- `populateFromRecurring(budgetId, householdId)` -> number (count created, skip duplicates via recurringExpenseId check)
- `closeMonth(budgetId, householdId)` -> SerializedMonthlyBudget (validate: bankBalance set, remaining=0, set status=closed, closedAt=now, auto-create next month)
- `reopenMonth(budgetId, householdId)` -> SerializedMonthlyBudget
- Helper: `computeBudgetSummary()` -- totalIncome = SUM(incomes), totalExpensesForecast = SUM(expenses), totalExpensesPaid = SUM(isPaid=true), totalExpensesUnpaid = forecast - paid, totalAvailable = income - forecast

**Create**: `src/services/income.ts`
- `createIncome(budgetId, householdId, data)` -> SerializedIncomeEntry (verify budget is open + belongs to household)
- `updateIncome(entryId, householdId, data)` -> SerializedIncomeEntry | null
- `deleteIncome(entryId, householdId)` -> boolean

**Create**: `src/services/expense.ts`
- `createExpense(budgetId, householdId, data)` -> SerializedExpenseEntry
- `updateExpense(entryId, householdId, data)` -> SerializedExpenseEntry | null
- `deleteExpense(entryId, householdId)` -> boolean
- `toggleExpensePaid(entryId, householdId, isPaid)` -> SerializedExpenseEntry | null
  - When isPaid=true and savingsBoxId set: auto-create SavingsTransaction(type=contribution, source=expense_link) in a $transaction
  - When toggling back to unpaid: reverse the auto-transaction

**Create**: `src/services/recurring-expense.ts`
- `getRecurringExpenses(householdId)` -> SerializedRecurringExpense[] (with category)
- `createRecurringExpense(householdId, data)` -> SerializedRecurringExpense
- `updateRecurringExpense(id, householdId, data)` -> SerializedRecurringExpense | null
- `deleteRecurringExpense(id, householdId)` -> boolean (soft: set isActive=false)
- `toggleRecurringExpenseActive(id, householdId, isActive)` -> SerializedRecurringExpense | null

**Create**: `src/services/savings-box.ts`
- `getSavingsBoxes(householdId)` -> SerializedSavingsBox[]
- `getSavingsBoxById(id, householdId)` -> SavingsBoxWithHistory | null (with transactions, goalProgress)
- `createSavingsBox(householdId, data)` -> SerializedSavingsBox
- `updateSavingsBox(id, householdId, data)` -> SerializedSavingsBox | null
- `deleteSavingsBox(id, householdId)` -> boolean (warn if balance > 0)
- `addTransaction(boxId, householdId, data)` -> SerializedSavingsTransaction (update balance atomically via $transaction)
- `distributeClosingBalance(householdId, allocations[])` -> void (batch create transactions with source=closing, update balances, all in $transaction)

**Verify**: `pnpm exec tsc --noEmit`

---

## Phase 1d: Server Actions — `PENDING`

**Create**: `src/actions/_helpers.ts` -- shared `resolveSessionAndHousehold()` that returns `{ userId, householdId }` or `{ error }`. Used by every finance action.

**Create**: `src/actions/household.ts`
- `createHouseholdAction(data)`, `addHouseholdMemberAction(email)`, `removeHouseholdMemberAction(memberId)`
- Revalidates: /finances, /dashboard

**Create**: `src/actions/category.ts`
- `createCategoryAction(data)`, `updateCategoryAction(id, data)`, `deleteCategoryAction(id)`
- Revalidates: /finances

**Create**: `src/actions/income.ts`
- `createIncomeAction(budgetId, data)`, `updateIncomeAction(entryId, data)`, `deleteIncomeAction(entryId)`
- Revalidates: /finances

**Create**: `src/actions/expense.ts`
- `createExpenseAction(budgetId, data)`, `updateExpenseAction(entryId, data)`, `deleteExpenseAction(entryId)`, `toggleExpensePaidAction(entryId, isPaid)`
- Revalidates: /finances, /finances/caixinhas

**Create**: `src/actions/recurring-expense.ts`
- `createRecurringExpenseAction(data)`, `updateRecurringExpenseAction(id, data)`, `deleteRecurringExpenseAction(id)`, `toggleRecurringExpenseActiveAction(id, isActive)`
- Revalidates: /finances/recurring

**Create**: `src/actions/savings-box.ts`
- `createSavingsBoxAction(data)`, `updateSavingsBoxAction(id, data)`, `deleteSavingsBoxAction(id)`, `addSavingsTransactionAction(boxId, data)`
- Revalidates: /finances/caixinhas

**Create**: `src/actions/month-closing.ts`
- `populateFromRecurringAction(budgetId)`, `reconcileMonthAction(budgetId, data)`, `distributeBalanceAction(budgetId, data)`, `closeMonthAction(budgetId)`, `reopenMonthAction(budgetId)`
- Revalidates: /finances, /finances/caixinhas

All actions follow: auth check via `resolveSessionAndHousehold()` -> zod safeParse -> service call -> revalidatePath -> return ActionResult<T>.

**Verify**: `pnpm exec tsc --noEmit`

---

## Phase 1e: Navigation + Middleware + Household Setup UI — `PENDING`

**Modify**: `src/middleware.ts`
- Add `pathname.startsWith("/finances")` to unauthenticated redirect check
- Add `"/finances/:path*"` to matcher config

**Modify**: `src/components/dashboard/nav-main.tsx`
- Add Finances nav group with icons: Wallet, CalendarCheck, PiggyBank, Repeat, Tags
- Sub-items: Monthly Budget (/finances), Caixinhas (/finances/caixinhas), Recurring (/finances/recurring), Categories (/finances/categories)

**Create**: `src/app/(dashboard)/finances/layout.tsx`
- Server component. Auth check. Fetch household for current user.
- If no household -> render `<HouseholdSetup />`
- If household exists -> render children wrapped in `<HouseholdProvider>`

**Create**: `src/components/finances/household-context.tsx`
- React context providing `{ householdId: number }` to all finance components

**Create**: `src/components/finances/household-setup.tsx`
- Card with form: household name input, submit button
- react-hook-form + zodResolver + createHouseholdSchema
- Calls createHouseholdAction, then router.refresh()

**Verify**: Navigate to /finances, see household setup. Create household, see nav items. `pnpm exec tsc --noEmit`.

---

## Phase 1f: Monthly Budget Page + Components — `PENDING`

**Create**: `src/app/(dashboard)/finances/page.tsx`
- Server component. Reads ?year and ?month searchParams (defaults to current).
- Fetches: getOrCreateMonthlyBudget(), getCategoriesByHousehold(), getSavingsBoxes()
- Renders: MonthNavigator, BudgetSummaryBar, IncomeSection, ExpenseList

**Create components in** `src/components/finances/`:

| Component | Type | Description |
|-----------|------|-------------|
| `month-navigator.tsx` | Client | Prev/next arrows, "Fevereiro 2026" label (pt-BR), status badge (Aberto/Fechado), updates URL searchParams |
| `budget-summary-bar.tsx` | Client | 5 summary cards (Entrada, Previsao, Pagos, A Pagar, Disponivel). 2-col mobile, 5-col desktop. formatCurrency() |
| `income-section.tsx` | Client | Collapsible section. Income list with category badge, edit/delete. + button opens IncomeFormSheet. Disabled if closed. |
| `income-form-sheet.tsx` | Client | Sheet form: description, amount, category Select. react-hook-form + zod |
| `income-delete-dialog.tsx` | Client | AlertDialog pattern |
| `expense-list.tsx` | Client | Expense rows: checkbox (paid toggle), description, amount, category badge, source badge. Row actions: edit/delete. Mobile=cards via useIsMobile(). + button opens ExpenseFormSheet. |
| `expense-form-sheet.tsx` | Client | Sheet form: description, amount, category Select, isPaid Switch, savingsBox Select (optional). react-hook-form + zod |
| `expense-delete-dialog.tsx` | Client | AlertDialog pattern |

**Verify**: Navigate months, add/edit/delete income and expenses, toggle paid, see summary update. Test mobile layout. `pnpm exec tsc --noEmit`.

---

## Phase 1g: Caixinhas Pages + Components — `PENDING`

**Create**: `src/app/(dashboard)/finances/caixinhas/page.tsx` -- server component, fetches getSavingsBoxes()
**Create**: `src/app/(dashboard)/finances/caixinhas/[id]/page.tsx` -- server component, fetches getSavingsBoxById()

**Create components in** `src/components/finances/`:

| Component | Type | Description |
|-----------|------|-------------|
| `savings-box-grid.tsx` | Client | Responsive grid: 1 col mobile, 2-3 cols desktop. Total balance card at top. |
| `savings-box-card.tsx` | Client | Card: icon + name, balance (large), monthly target bar, goal progress %. Click -> detail page. |
| `savings-box-detail.tsx` | Client | Header (name, balance, goal progress), action buttons (Contribuir, Retirar, Edit), transaction history list |
| `savings-box-form-sheet.tsx` | Client | Sheet form: name, monthlyTarget, goalAmount, icon, color |
| `savings-box-delete-dialog.tsx` | Client | AlertDialog with balance > 0 warning |
| `savings-transaction-sheet.tsx` | Client | Sheet form: amount, description. Type (contribution/withdrawal) from props. Validates withdrawal <= balance. |

**Add shadcn**: `pnpm dlx shadcn@latest add progress` (for goal progress bars)

**Verify**: Create boxes, add contributions/withdrawals, verify balance updates, check goal progress bar. `pnpm exec tsc --noEmit`.

---

## Phase 1h: Recurring Expenses Page + Components — `PENDING`

**Create**: `src/app/(dashboard)/finances/recurring/page.tsx` -- server component, fetches getRecurringExpenses() + getCategoriesByHousehold("expense")

**Create components in** `src/components/finances/`:

| Component | Type | Description |
|-----------|------|-------------|
| `recurring-expense-list.tsx` | Client | Table (desktop) / cards (mobile): description, amount, category, dayOfMonth, active Switch. + button for create. |
| `recurring-expense-form-sheet.tsx` | Client | Sheet form: description, amount, category Select, dayOfMonth input (1-31 optional) |
| `recurring-expense-delete-dialog.tsx` | Client | AlertDialog. Note: existing generated expenses won't be deleted. |

**Verify**: Create/edit/delete recurring expenses, toggle active/inactive. `pnpm exec tsc --noEmit`.

---

## Phase 1i: Month Closing Flow — `PENDING`

**Create components in** `src/components/finances/`:

| Component | Type | Description |
|-----------|------|-------------|
| `month-closing-wizard.tsx` | Client | Multi-step Sheet/Dialog: Step 1 (Reconcile: show calculated vs enter bank balance), Step 2 (Distribute: allocate remaining to caixinhas until R$0), Step 3 (Close: confirm + success). State machine progression. |
| `month-closing-button.tsx` | Client | If open: "Fechar Mes" button -> opens wizard. If closed: "Mes Fechado" badge + "Reabrir" button with AlertDialog confirmation. |
| `populate-recurring-button.tsx` | Client | "Carregar Recorrentes" button with Repeat icon. Calls populateFromRecurringAction. Toast with count. Disabled if closed. |

**Modify**: `src/app/(dashboard)/finances/page.tsx` -- add MonthClosingButton and PopulateRecurringButton to the layout.

**Verify**: Full close flow: populate recurring -> pay expenses -> reconcile -> distribute to caixinhas -> close -> verify read-only -> verify next month created. `pnpm exec tsc --noEmit`.

---

## Phase 1j: Dashboard Integration — `PENDING`

**Modify**: `src/app/(dashboard)/dashboard/page.tsx`
- Fetch current month's budget summary + household check
- Render FinanceSummaryCard if household exists

**Create**: `src/components/dashboard/finance-summary-card.tsx`
- Compact card: month name + status badge, Entrada/Gastos/Disponivel, link to /finances

**Verify**: Dashboard shows finance summary. Link navigates to /finances. `pnpm exec tsc --noEmit`.

---

## Phase 1k: Categories Management Page — `PENDING`

**Create**: `src/app/(dashboard)/finances/categories/page.tsx` -- server component, two sections (income/expense categories)

**Create components in** `src/components/finances/`:

| Component | Type | Description |
|-----------|------|-------------|
| `category-list.tsx` | Client | List by type with edit/delete + create button |
| `category-form-sheet.tsx` | Client | Sheet form: name, icon, color, sortOrder |
| `category-delete-dialog.tsx` | Client | AlertDialog with "in-use" check warning |

**Verify**: Create/edit/delete categories. Verify they appear in dropdowns on budget page. `pnpm exec tsc --noEmit`.

---

## Phase 1.5: Data Migration (Google Sheets) — `PENDING`

**Create**: `scripts/migrate-sheets.ts` -- main migration script (run via `pnpm exec tsx scripts/migrate-sheets.ts`)

**Approach**:
1. Pre-export: use MCP Google Sheets tools to read all tabs, save as JSON in `scripts/data/months/*.json` and `scripts/data/caixinhas.json`
2. Parse each monthly JSON: row 2 col A for income total, rows 4+ for expenses (col A=description, B=amount, C=status "PAGO"/empty, D=caixinha name, E=caixinha amount)
3. Parse Caixinhas JSON: 4 boxes side-by-side, each with contribution history
4. AI categorization: batch expense descriptions to Gemini, get back category mapping
5. Write to DB via Prisma: create MonthlyBudgets (closed for historical, open for current), IncomeEntries, ExpenseEntries, SavingsBoxes, SavingsTransactions
6. Verification: log counts, compare totals against spreadsheet values

**Create**: `scripts/migrate-sheets-parser.ts` -- parsing logic for BRL amounts, monthly tab structure, caixinhas tab structure
**Create**: `scripts/migrate-sheets-categorize.ts` -- Gemini API batch categorization

**Special tabs** (Mudanca, Ferias 07/2024, Curitiba, Reveiao, Itens para casa): not migrated -- stay in spreadsheet as archive.

**Verify**: Run migration. Compare total counts and sums against original spreadsheet. Check all historical months are "closed", current month is "open". Check caixinha balances match.

---

## Phase 2: Adapters (Gmail + Drive) — `PENDING` (Future)

Build the automated bill detection layer on top of the working manual system.

**Includes:**
- Gmail adapter: OAuth connection, email scanning, AI extraction (Gemini)
- Drive PDF adapter: folder watching, PDF parsing, AI extraction
- Adapter configuration UI (which Gmail labels to scan, which Drive folder to watch)
- Expense source tracking (draft/auto tags in the expense list)
- Trusted source management: mark sources as trusted for auto-approval
- Auto-recurring detection: suggest recurring expense templates for monthly patterns
- Background sync mechanism (periodic checks for new bills)

---

# Reference

## Complete New File List

### Infrastructure (Phases 1a-1d)
| File | Phase |
|------|-------|
| `prisma/schema.prisma` (modify) | 1a |
| `src/types/finances.ts` | 1b |
| `src/lib/schemas/finances.ts` | 1b |
| `src/services/household.ts` | 1c |
| `src/services/category.ts` | 1c |
| `src/services/monthly-budget.ts` | 1c |
| `src/services/income.ts` | 1c |
| `src/services/expense.ts` | 1c |
| `src/services/recurring-expense.ts` | 1c |
| `src/services/savings-box.ts` | 1c |
| `src/actions/_helpers.ts` | 1d |
| `src/actions/household.ts` | 1d |
| `src/actions/category.ts` | 1d |
| `src/actions/income.ts` | 1d |
| `src/actions/expense.ts` | 1d |
| `src/actions/recurring-expense.ts` | 1d |
| `src/actions/savings-box.ts` | 1d |
| `src/actions/month-closing.ts` | 1d |

### Navigation + Household (Phase 1e)
| File | Phase |
|------|-------|
| `src/middleware.ts` (modify) | 1e |
| `src/components/dashboard/nav-main.tsx` (modify) | 1e |
| `src/app/(dashboard)/finances/layout.tsx` | 1e |
| `src/components/finances/household-context.tsx` | 1e |
| `src/components/finances/household-setup.tsx` | 1e |

### Monthly Budget (Phase 1f)
| File | Phase |
|------|-------|
| `src/app/(dashboard)/finances/page.tsx` | 1f |
| `src/components/finances/month-navigator.tsx` | 1f |
| `src/components/finances/budget-summary-bar.tsx` | 1f |
| `src/components/finances/income-section.tsx` | 1f |
| `src/components/finances/income-form-sheet.tsx` | 1f |
| `src/components/finances/income-delete-dialog.tsx` | 1f |
| `src/components/finances/expense-list.tsx` | 1f |
| `src/components/finances/expense-form-sheet.tsx` | 1f |
| `src/components/finances/expense-delete-dialog.tsx` | 1f |

### Caixinhas (Phase 1g)
| File | Phase |
|------|-------|
| `src/app/(dashboard)/finances/caixinhas/page.tsx` | 1g |
| `src/app/(dashboard)/finances/caixinhas/[id]/page.tsx` | 1g |
| `src/components/finances/savings-box-grid.tsx` | 1g |
| `src/components/finances/savings-box-card.tsx` | 1g |
| `src/components/finances/savings-box-detail.tsx` | 1g |
| `src/components/finances/savings-box-form-sheet.tsx` | 1g |
| `src/components/finances/savings-box-delete-dialog.tsx` | 1g |
| `src/components/finances/savings-transaction-sheet.tsx` | 1g |

### Recurring (Phase 1h)
| File | Phase |
|------|-------|
| `src/app/(dashboard)/finances/recurring/page.tsx` | 1h |
| `src/components/finances/recurring-expense-list.tsx` | 1h |
| `src/components/finances/recurring-expense-form-sheet.tsx` | 1h |
| `src/components/finances/recurring-expense-delete-dialog.tsx` | 1h |

### Month Closing (Phase 1i)
| File | Phase |
|------|-------|
| `src/components/finances/month-closing-wizard.tsx` | 1i |
| `src/components/finances/month-closing-button.tsx` | 1i |
| `src/components/finances/populate-recurring-button.tsx` | 1i |

### Dashboard (Phase 1j)
| File | Phase |
|------|-------|
| `src/app/(dashboard)/dashboard/page.tsx` (modify) | 1j |
| `src/components/dashboard/finance-summary-card.tsx` | 1j |

### Categories (Phase 1k)
| File | Phase |
|------|-------|
| `src/app/(dashboard)/finances/categories/page.tsx` | 1k |
| `src/components/finances/category-list.tsx` | 1k |
| `src/components/finances/category-form-sheet.tsx` | 1k |
| `src/components/finances/category-delete-dialog.tsx` | 1k |

### Migration (Phase 1.5)
| File | Phase |
|------|-------|
| `scripts/migrate-sheets.ts` | 1.5 |
| `scripts/migrate-sheets-parser.ts` | 1.5 |
| `scripts/migrate-sheets-categorize.ts` | 1.5 |

### shadcn/ui Components to Add
- `progress` -- savings goal progress bars
- `toast` / `sonner` -- action feedback

## Pattern Reference Files

| Pattern | Reference File |
|---------|---------------|
| Server Actions | `src/actions/purchase.ts` |
| Services | `src/services/purchase.ts`, `src/services/product.ts` |
| Types (serialization) | `src/types/purchase.ts` |
| Zod Schemas | `src/lib/schemas/purchase.ts` |
| Form Sheet | `src/components/purchases/purchase-edit-sheet.tsx` |
| Delete Dialog | `src/components/purchases/purchase-delete-dialog.tsx` |
| Data Table + Mobile Cards | `src/components/purchases/purchases-data-table.tsx` |
| Navigation | `src/components/dashboard/nav-main.tsx` |
| Page (Server Component) | `src/app/(dashboard)/groceries/page.tsx` |

## Verification (after each phase)

1. `pnpm exec prettier --write .`
2. `pnpm lint:fix`
3. `pnpm exec tsc --noEmit`
4. Manual testing on mobile + desktop viewports

## End-to-End Test (after all Phase 1 sub-phases)

1. Create household -> see finances nav appear
2. Add categories -> see them in dropdowns
3. Navigate to /finances -> see current month auto-created
4. Add income entries -> summary updates
5. Add expense entries with categories -> summary updates
6. Toggle expenses paid -> "Gastos Pagos" updates
7. Create recurring expenses -> populate into month -> see them in expense list
8. Create savings boxes -> see in /finances/caixinhas
9. Link expense to savings box -> mark paid -> see contribution in box detail
10. Close month -> reconcile -> distribute -> close -> verify next month created
11. Navigate to closed month -> verify read-only
