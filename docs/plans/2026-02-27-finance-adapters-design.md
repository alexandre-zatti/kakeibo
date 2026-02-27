# Finance Adapters System — Design Document

**Date:** 2026-02-27
**Branch:** feature/finances
**Status:** Approved

## Goal

Automate bill collection from external sources (Gmail, Google Drive, etc.) into monthly expenses with attachments. Users configure adapters via UI, which link to code modules that fetch bills and create expenses automatically when triggered.

## Architecture Overview

**Pattern:** Simple registry with DB-backed adapter instances. Code modules provide execution logic. DB records provide CRUD, activation state, and run tracking.

**Runtime:** Inside Next.js — async execution via fire-and-forget after API response using `waitUntil()` or detached Promises.

**Trigger:** Manual "Run Adapters" button on the finances page, tied to month lifecycle.

**Google auth:** Service account credentials via environment variables.

## Adapter Interface Contract

```typescript
// src/adapters/types.ts

interface AdapterModule {
  /** Human-readable label for module selection in UI */
  label: string;
  /** The execution function */
  execute: (context: AdapterContext) => Promise<AdapterResult>;
}

interface AdapterContext {
  /** The household this adapter runs for */
  householdId: number;
  /** The monthly budget being populated */
  budgetId: number;
  /** Year/month of the budget */
  year: number;
  month: number;
  /** The adapter DB record (for accessing name, config, etc.) */
  adapter: SerializedAdapter;
}

interface AdapterResult {
  /** Was the adapter execution successful? */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** The expense data to create */
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

## Code Structure

```
src/adapters/
├── types.ts                    # AdapterModule, AdapterContext, AdapterResult interfaces
├── modules/
│   ├── index.ts                # Registry: Record<string, AdapterModule>
│   ├── electric-bill.ts        # Gmail adapter for electric company
│   ├── water-bill.ts           # Gmail adapter for water company
│   └── drive-folder.ts         # Google Drive folder adapter
├── runner.ts                   # Orchestrates adapter execution
└── file-storage.ts             # Handles saving/reading attachment files
```

## Database Models

### Adapter (new)

Stores adapter instances created via UI. Each links to a code module.

| Field | Type | Description |
|-------|------|-------------|
| id | Int (PK) | Auto-increment |
| createdAt | DateTime | |
| updatedAt | DateTime | |
| name | VARCHAR(255) | User-given name, e.g., "Conta de Luz" |
| description | TEXT? | Optional description |
| moduleKey | VARCHAR(100) | Code module key (e.g., "electric-bill") |
| isActive | Boolean (default true) | Toggle from UI |
| householdId | FK → Household | |

### AdapterRun (new)

Tracks each batch execution (when adapters run for a month).

| Field | Type | Description |
|-------|------|-------------|
| id | Int (PK) | Auto-increment |
| createdAt | DateTime | When the run started |
| updatedAt | DateTime | Last status change |
| householdId | FK → Household | |
| monthlyBudgetId | FK → MonthlyBudget | Which month triggered this |
| status | VARCHAR(20) | `running`, `completed`, `failed`, `partial` |
| completedAt | DateTime? | When all adapters finished |

### AdapterRunLog (new)

One entry per adapter per run.

| Field | Type | Description |
|-------|------|-------------|
| id | Int (PK) | Auto-increment |
| createdAt | DateTime | When this adapter started |
| updatedAt | DateTime | Last update |
| adapterRunId | FK → AdapterRun | Parent run |
| adapterId | FK → Adapter | Which adapter |
| status | VARCHAR(20) | `pending`, `running`, `success`, `error`, `skipped` |
| errorMessage | TEXT? | Error details if failed |
| expenseEntryId | FK → ExpenseEntry? | The created expense, if any |
| attachmentPath | VARCHAR(500)? | File path of saved attachment |
| completedAt | DateTime? | When finished |

### ExpenseEntry (modified)

Add field:

| Field | Type | Description |
|-------|------|-------------|
| attachmentPath | VARCHAR(500)? | Path to attachment file on disk |

### New ExpenseSource value

Add `"adapter"` to the `source` enum on ExpenseEntry (alongside manual, draft, auto, recurring).

## File Storage

- **Path pattern:** `data/uploads/finances/{householdId}/{year}-{month}/{adapterId}-{timestamp}.ext`
- **Location:** Outside `public/` directory — not directly accessible via URL
- **Access:** Server Components read files from disk and render inline (base64 in iframe for PDFs, img tag for images)
- **No extra API routes** for file access — fully server-side

## Execution Flow

```
1. User clicks "Run Adapters" on /finances page
2. POST /api/adapters/run { budgetId }
3. API route:
   a. Queries active Adapter records for the household
   b. Creates AdapterRun record (status: "running")
   c. Creates AdapterRunLog for each active adapter (status: "pending")
   d. Returns { runId } immediately → UI shows "Adapters running..."
   e. Kicks off async execution (fire-and-forget)
4. Async runner (sequential to avoid rate limits):
   a. For each adapter:
      - Look up code module by adapter.moduleKey
      - Update log status → "running"
      - Call module.execute(context)
      - If success + expense: create ExpenseEntry (source: "adapter"), save attachment
      - Update log with result (status, expenseEntryId, attachmentPath)
      - If error: update log with error message
   b. Update AdapterRun status → "completed" / "partial" / "failed"
5. User refreshes /finances/adapters → sees run status and results
```

## Management UI

### New page: `/finances/adapters`

**Adapter List:**
- Table/cards showing all adapters for the household
- Columns: name, module, active status, last run result
- Actions: toggle active, edit, delete

**Create/Edit Adapter:**
- Form: name, description, module (dropdown from code registry)
- Module dropdown populated from `adapterModules` keys

**Run History:**
- List of AdapterRun records (latest first)
- Each row: date, month, status badge, adapter count
- Expandable: shows per-adapter AdapterRunLog entries

**Per-Adapter Log:**
- Status badge (pending/running/success/error/skipped)
- Created expense link (if success)
- Error message (if failed)
- Retry button (re-runs that single adapter)

**Actions:**
- "Run Adapters" button (triggers full run)
- "Retry" on failed adapters
- "Stop" on running adapters (marks as skipped)

### Main finances page `/finances`

- "Run Adapters" button alongside existing "Populate Recurring" button
- Badge showing latest run status

### Expense detail

- Expenses with `attachmentPath` show a "View Bill" indicator/button
- Clicking opens the attachment inline via Server Component (PDF in iframe, images in img tag)

## Google Service Account Setup

Environment variables:
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` — service account email
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` — private key for JWT signing

The service account needs:
- Gmail API access (delegated to the user's Gmail account)
- Google Drive API access (for Drive folder adapters)

Utility module at `src/lib/google.ts` for creating authenticated Gmail/Drive clients.

## Example Adapter Module

```typescript
// src/adapters/modules/electric-bill.ts
import { AdapterModule } from "../types";
import { getGmailClient } from "@/lib/google";

export const electricBill: AdapterModule = {
  label: "Electric Bill (Gmail)",

  async execute(context) {
    const gmail = await getGmailClient();

    // Search for latest email from the electric company
    const messages = await gmail.users.messages.list({
      userId: "me",
      q: "from:noreply@cpfl.com.br subject:fatura",
      maxResults: 1,
    });

    if (!messages.data.messages?.length) {
      return { success: true }; // No email found
    }

    // Get the email and extract data
    const message = await gmail.users.messages.get({
      userId: "me",
      id: messages.data.messages[0].id!,
      format: "full",
    });

    const amount = parseAmountFromBody(message.data);
    const attachment = await extractAttachment(gmail, message.data);

    return {
      success: true,
      expense: {
        description: "Conta de Luz - CPFL",
        amount,
        categoryId: 5, // Moradia
        attachment: attachment
          ? { filename: "fatura-luz.pdf", mimeType: "application/pdf", data: attachment }
          : undefined,
      },
    };
  },
};
```

## Key Design Decisions

1. **Code modules + DB instances:** Adapters are code for execution logic, DB records for CRUD and state. Best of both worlds.
2. **Async execution:** Fire-and-forget from API route. DB tracks progress. No blocking UI.
3. **Sequential execution:** Adapters run one-at-a-time to avoid Google API rate limits.
4. **Server-side file access:** Files stored outside public/, read by Server Components. No file-serving API routes.
5. **Manual trigger:** Fits the existing manual month lifecycle. No cron/polling needed.
6. **Auto-create expenses:** Adapters create expenses directly (source: "adapter"). No review queue.
7. **Service account auth:** Single setup, no per-user OAuth flow. Appropriate for personal/household app.
