# Attachment UI Improvements Design

## Goal

Replace the Paperclip icon link with a visually richer badge indicator and show attachments in a Sheet modal via Next.js intercepting routes instead of full-page navigation.

## Current State

- Expense rows show a Paperclip icon that navigates to `/finances/attachment/[id]` (full page)
- `AttachmentViewer` is a Server Component that reads files from disk and renders PDFs in iframe / images in img tag
- The full-page attachment route exists at `src/app/(dashboard)/finances/attachment/[id]/page.tsx`

## Design

### 1. Expense Row Badge Indicator

Replace the Paperclip `<Link>` with a clickable badge:

- **Text**: Derived from file extension (e.g., `"PDF"`, `"IMG"`) with `"Anexo"` as fallback
- **Style**: Distinct from category/source badges — use a secondary variant with cursor-pointer to signal interactivity
- **Behavior**: Wraps a `<Link>` to `/finances/attachment/{id}`, which the intercepting route captures on soft navigation

### 2. Intercepting Route Structure

```
src/app/(dashboard)/finances/
  layout.tsx                              # Modified: accept { children, modal } props
  @modal/
    default.tsx                           # Returns null when no modal active
    (.)attachment/
      [id]/
        page.tsx                          # Intercepting route: Sheet with AttachmentViewer
  attachment/
    [id]/
      page.tsx                            # Unchanged: full-page fallback for hard navigation
```

### 3. Sheet Modal (AttachmentSheet)

A client component (`src/components/adapters/attachment-sheet.tsx`) that:

- Wraps children in a `<Sheet>` (consistent with app pattern)
- Always renders open, closes via `router.back()`
- Uses `sm:max-w-lg` for more width than standard form sheets
- Header shows the expense description
- Body renders the `AttachmentViewer` server component (passed as children from the intercepting route server page)

### 4. Data Flow

| Navigation type | Behavior |
|----------------|----------|
| Soft nav (badge click) | Finances page stays visible, `@modal` slot renders Sheet with AttachmentViewer server-rendered |
| Hard nav (direct URL, refresh) | Existing full-page attachment view renders as fallback |
| Back navigation | Modal dismisses, returns to finances page |

### 5. Files Changed/Created

| File | Action | Description |
|------|--------|-------------|
| `src/app/(dashboard)/finances/layout.tsx` | Modify | Add `modal` parallel slot prop |
| `src/app/(dashboard)/finances/@modal/default.tsx` | Create | Return null (inactive state) |
| `src/app/(dashboard)/finances/@modal/(.)attachment/[id]/page.tsx` | Create | Server page: auth + AttachmentViewer inside AttachmentSheet |
| `src/components/adapters/attachment-sheet.tsx` | Create | Client Sheet wrapper with router.back() close behavior |
| `src/components/finances/expense-list.tsx` | Modify | Replace Paperclip link with badge Link, add helper for file extension label |

### 6. Key Decisions

- **No API route needed**: The intercepting route is a server component, so AttachmentViewer reads files from disk directly
- **Sheet over Dialog**: Consistent with existing app patterns (forms use sheets, only delete confirmations use AlertDialog)
- **Badge over icon**: More visually distinctive and informative (shows file type)
- **Intercepting routes**: Clean UX — modal on click, full page on direct navigation/refresh
