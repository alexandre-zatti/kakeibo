# Attachment UI Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the Paperclip icon with a badge indicator and show attachments in a Sheet modal via Next.js intercepting routes instead of full-page navigation.

**Architecture:** Next.js parallel routes (`@modal` slot) with intercepting routes (`(.)attachment`) to render the existing `AttachmentViewer` server component inside a client-side Sheet. Soft navigation opens the Sheet modal; hard navigation/refresh falls through to the existing full-page view.

**Tech Stack:** Next.js 15 App Router (parallel + intercepting routes), shadcn/ui Sheet, Radix Dialog primitive, Lucide icons

---

### Task 1: Create the AttachmentSheet client wrapper

This client component wraps children in a Sheet that is always open and closes via `router.back()`.

**Files:**
- Create: `src/components/adapters/attachment-sheet.tsx`

**Step 1: Create the component**

Create `src/components/adapters/attachment-sheet.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

interface AttachmentSheetProps {
  title: string;
  children: React.ReactNode;
}

export function AttachmentSheet({ title, children }: AttachmentSheetProps) {
  const router = useRouter();

  return (
    <Sheet open onOpenChange={() => router.back()}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="truncate">{title}</SheetTitle>
          <SheetDescription>Visualização do anexo</SheetDescription>
        </SheetHeader>
        <div className="py-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
```

**Step 2: Run checks**

```bash
pnpm exec prettier --write src/components/adapters/attachment-sheet.tsx
pnpm exec tsc --noEmit
```

Expected: No errors.

**Step 3: Commit**

```bash
git add src/components/adapters/attachment-sheet.tsx
git commit -m "Add AttachmentSheet client wrapper for modal attachment viewing"
```

---

### Task 2: Create the @modal parallel route slot

Set up the `@modal` directory with its `default.tsx` (returns null when inactive).

**Files:**
- Create: `src/app/(dashboard)/finances/@modal/default.tsx`

**Step 1: Create the default file**

Create `src/app/(dashboard)/finances/@modal/default.tsx`:

```tsx
export default function Default() {
  return null;
}
```

**Step 2: Commit**

```bash
git add src/app/(dashboard)/finances/@modal/default.tsx
git commit -m "Add @modal parallel route slot with null default"
```

---

### Task 3: Create the intercepting route page

This server component page intercepts `/finances/attachment/[id]` on soft navigation and renders the AttachmentViewer inside the AttachmentSheet.

**Files:**
- Create: `src/app/(dashboard)/finances/@modal/(.)attachment/[id]/page.tsx`

**Step 1: Create the intercepting route page**

Create `src/app/(dashboard)/finances/@modal/(.)attachment/[id]/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getHouseholdByUserId } from "@/services/household";
import { prisma } from "@/lib/prisma";
import { AttachmentViewer } from "@/components/adapters/attachment-viewer";
import { AttachmentSheet } from "@/components/adapters/attachment-sheet";

export default async function AttachmentInterceptedPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
  });

  if (!expense?.attachmentPath) redirect("/finances");

  return (
    <AttachmentSheet title={expense.description}>
      <AttachmentViewer filePath={expense.attachmentPath} />
    </AttachmentSheet>
  );
}
```

**Step 2: Run checks**

```bash
pnpm exec prettier --write "src/app/(dashboard)/finances/@modal/(.)attachment/[id]/page.tsx"
pnpm exec tsc --noEmit
```

Expected: No errors.

**Step 3: Commit**

```bash
git add "src/app/(dashboard)/finances/@modal/(.)attachment/[id]/page.tsx"
git commit -m "Add intercepting route to show attachment in Sheet modal"
```

---

### Task 4: Update finances layout to accept @modal slot

Modify the finances layout to accept and render the `modal` parallel slot prop.

**Files:**
- Modify: `src/app/(dashboard)/finances/layout.tsx:7,20`

**Step 1: Update the layout**

In `src/app/(dashboard)/finances/layout.tsx`, change the function signature from:

```tsx
export default async function FinancesLayout({ children }: { children: React.ReactNode }) {
```

to:

```tsx
export default async function FinancesLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
```

And change the return from:

```tsx
return <HouseholdProvider householdId={household.id}>{children}</HouseholdProvider>;
```

to:

```tsx
return (
  <HouseholdProvider householdId={household.id}>
    {children}
    {modal}
  </HouseholdProvider>
);
```

**Step 2: Run checks**

```bash
pnpm exec prettier --write src/app/\(dashboard\)/finances/layout.tsx
pnpm exec tsc --noEmit
```

Expected: No errors.

**Step 3: Commit**

```bash
git add "src/app/(dashboard)/finances/layout.tsx"
git commit -m "Add @modal parallel slot to finances layout"
```

---

### Task 5: Replace Paperclip icon with badge Link in expense list

Replace the Paperclip `<Link>` with a clickable badge that shows the file type (e.g., "PDF"). The badge links to `/finances/attachment/[id]`, which the intercepting route will capture.

**Files:**
- Modify: `src/components/finances/expense-list.tsx:4,87-95`

**Step 1: Update imports**

In `src/components/finances/expense-list.tsx`, change:

```tsx
import { Paperclip, Pencil, Plus, Trash2 } from "lucide-react";
```

to:

```tsx
import { Pencil, Plus, Trash2 } from "lucide-react";
```

(Remove `Paperclip` — no longer used.)

**Step 2: Add file extension helper**

Add this helper function inside the file, before the `ExpenseList` component (after the imports, before the interface):

```tsx
function getAttachmentLabel(path: string): string {
  const ext = path.split(".").pop()?.toUpperCase();
  if (ext === "PDF" || ext === "PNG" || ext === "JPG" || ext === "JPEG" || ext === "WEBP") {
    return ext === "JPEG" ? "JPG" : ext;
  }
  return "Anexo";
}
```

**Step 3: Replace Paperclip block with badge Link**

Replace the block at lines 87-95:

```tsx
                {entry.attachmentPath && (
                  <Link
                    href={`/finances/attachment/${entry.id}`}
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                    title="Ver anexo"
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                  </Link>
                )}
```

with:

```tsx
                {entry.attachmentPath && (
                  <Badge variant="secondary" className="shrink-0 cursor-pointer text-xs" asChild>
                    <Link href={`/finances/attachment/${entry.id}`}>
                      {getAttachmentLabel(entry.attachmentPath)}
                    </Link>
                  </Badge>
                )}
```

Note: The shadcn `Badge` component does not support `asChild` out of the box. We need to wrap the Link around the Badge instead:

```tsx
                {entry.attachmentPath && (
                  <Link href={`/finances/attachment/${entry.id}`} className="shrink-0">
                    <Badge variant="secondary" className="cursor-pointer text-xs">
                      {getAttachmentLabel(entry.attachmentPath)}
                    </Badge>
                  </Link>
                )}
```

**Step 4: Run checks**

```bash
pnpm exec prettier --write src/components/finances/expense-list.tsx
pnpm lint:fix
pnpm exec tsc --noEmit
```

Expected: No errors.

**Step 5: Commit**

```bash
git add src/components/finances/expense-list.tsx
git commit -m "Replace Paperclip icon with file-type badge for attachments"
```

---

### Task 6: Smoke test and final verification

**Step 1: Start dev server**

```bash
pnpm dev
```

**Step 2: Verify the intercepting route works**

1. Navigate to `/finances` with a budget that has an adapter-created expense with attachment
2. Verify the expense row shows a "PDF" badge (secondary variant) instead of a Paperclip icon
3. Click the badge — a Sheet should slide in from the right showing the PDF in an iframe
4. Close the Sheet (X button or click overlay) — should return to the finances page without navigation
5. Hard-navigate directly to `/finances/attachment/{id}` — should show the full-page fallback view

**Step 3: Run all checks**

```bash
pnpm exec prettier --write .
pnpm lint:fix
pnpm exec tsc --noEmit
```

Expected: All pass with zero errors.

**Step 4: Commit any remaining changes**

```bash
git add -A
git commit -m "Final cleanup for attachment UI improvements"
```
