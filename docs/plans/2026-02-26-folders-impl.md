# Folders Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add hierarchical folder organization for documents and templates with nested subfolders, context-menu actions, visibility controls, pinning, and breadcrumb navigation.

**Architecture:** New `folders` table with self-referential `parentId` for nesting (max depth 10). Documents and templates get an optional `folderId` foreign key. Backend provides CRUD mutations with circular-reference prevention and recursive delete. Frontend adds a collapsible folder sidebar (resizable panel) to existing documents/templates pages, plus a breadcrumb bar and move-to-folder dialog. No drag-and-drop — all moves via context menu + dialog.

**Tech Stack:** Convex (schema, queries, mutations), React 19, TanStack Router (query params for folder state), Shadcn UI (resizable panel, context menu, dialog, breadcrumbs), Tailwind CSS v4.

**Design Doc:** `docs/plans/2026-02-25-folders-design.md`

**Decisions locked in during brainstorming:**

- No drag-and-drop (context menu "Move to..." only)
- No plan gating (skip Free/Pro checks for now)
- Resizable sidebar panel layout (collapsible)

---

## Task 1: Create folders schema and register table

**Files:**

- Create: `apps/backend/convex/schemas/folders.ts`
- Modify: `apps/backend/convex/schema.ts`

**Step 1: Create the folders schema file**

```typescript
// apps/backend/convex/schemas/folders.ts
import { defineTable } from "convex/server";
import { type Infer, v } from "convex/values";

export const folderTypeTuple = v.union(v.literal("document"), v.literal("template"));
export type FolderType = Infer<typeof folderTypeTuple>;

export const folderVisibilityTuple = v.union(v.literal("everyone"), v.literal("admin"));
export type FolderVisibility = Infer<typeof folderVisibilityTuple>;

export const foldersTable = defineTable({
  organizationId: v.id("organizations"),
  name: v.string(),
  parentId: v.optional(v.id("folders")), // null = root level
  type: folderTypeTuple,
  visibility: folderVisibilityTuple,
  pinned: v.optional(v.boolean()),
  createdBy: v.id("users"),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_organization", ["organizationId"])
  .index("by_parent", ["parentId"])
  .index("by_org_type", ["organizationId", "type"])
  .index("by_org_created_by", ["organizationId", "createdBy"]);
```

**Step 2: Register in schema.ts**

Add import:

```typescript
import { foldersTable, type FolderType, type FolderVisibility } from "./schemas/folders";
```

Add type re-exports:

```typescript
export type { FolderType, FolderVisibility };
```

Add to schema definition (after `document_reminders`):

```typescript
folders: foldersTable,
```

**Step 3: Add folderId to documents schema**

In `apps/backend/convex/schemas/documents.ts`, add field inside `documentsTable` (after `sourceTemplateId`):

```typescript
folderId: v.optional(v.id("folders")),
```

Add indexes (after existing indexes):

```typescript
.index("by_folder", ["folderId"])
.index("by_org_folder", ["organizationId", "folderId"])
```

**Step 4: Add folderId to templates schema**

In `apps/backend/convex/schemas/templates.ts`, add field inside `templatesTable` (after `sourceDocumentId`):

```typescript
folderId: v.optional(v.id("folders")),
```

Add index (after existing indexes):

```typescript
.index("by_folder", ["folderId"])
```

**Step 5: Run typecheck**

Run: `bun --bun run typecheck`
Expected: All workspaces pass. Convex codegen will regenerate `_generated/` types.

**Step 6: Commit**

```
feat(folders): add folders schema, register table, add folderId to documents and templates
```

---

## Task 2: Create folder mutations

**Files:**

- Create: `apps/backend/convex/folders/mutations.ts`

**Reference:** Auth wrappers are in `apps/backend/convex/auth.ts`. Use `adminMutation` for mutations that need admin+ access, `authMutation` for basic auth. The design doc says folder creation follows `documents:create` / `templates:create` permissions but for simplicity we'll use `adminMutation` (admin/owner can manage folders, members view them).

**Step 1: Create the mutations file with all 6 mutations**

```typescript
// apps/backend/convex/folders/mutations.ts
import { ConvexError, v } from "convex/values";

import { adminMutation, authMutation } from "../auth";

// ── Helpers ──────────────────────────────────────────────────────────────

/** Walk ancestor chain and return depth. Throws if depth exceeds max. */
async function getAncestorDepth(
  db: { get: (id: unknown) => Promise<{ parentId?: string } | null> },
  parentId: string | undefined,
  maxDepth: number,
): Promise<number> {
  let current = parentId;
  let depth = 0;
  while (current) {
    depth++;
    if (depth > maxDepth) {
      throw new ConvexError(`Folder nesting cannot exceed ${maxDepth} levels`);
    }
    const parent = await (db as { get(id: string): Promise<{ parentId?: string } | null> }).get(
      current,
    );
    if (!parent) break;
    current = parent.parentId;
  }
  return depth;
}

/** Walk ancestor chain to detect circular reference. */
async function detectCircularReference(
  db: { get: (id: unknown) => Promise<{ parentId?: string } | null> },
  folderId: string,
  newParentId: string | undefined,
): Promise<void> {
  if (!newParentId) return; // Moving to root is always safe
  let current: string | undefined = newParentId;
  let depth = 0;
  while (current && depth < 20) {
    if (current === folderId) {
      throw new ConvexError("Cannot move a folder into its own descendant");
    }
    const folder = await (db as { get(id: string): Promise<{ parentId?: string } | null> }).get(
      current,
    );
    if (!folder) break;
    current = folder.parentId;
    depth++;
  }
}

// ── Mutations ────────────────────────────────────────────────────────────

export const createFolder = adminMutation({
  args: {
    name: v.string(),
    parentId: v.optional(v.id("folders")),
    type: v.union(v.literal("document"), v.literal("template")),
    visibility: v.optional(v.union(v.literal("everyone"), v.literal("admin"))),
  },
  handler: async (ctx, args) => {
    const name = args.name.trim();
    if (!name) throw new ConvexError("Folder name cannot be empty");

    // Validate parent folder if provided
    if (args.parentId) {
      const parent = await ctx.db.get(args.parentId);
      if (!parent || parent.organizationId !== ctx.auth.organization._id) {
        throw new ConvexError("Parent folder not found");
      }
      if (parent.type !== args.type) {
        throw new ConvexError("Parent folder type must match");
      }
    }

    // Check nesting depth (max 10)
    await getAncestorDepth(ctx.db, args.parentId, 10);

    const folderId = await ctx.db.insert("folders", {
      organizationId: ctx.auth.organization._id,
      name,
      parentId: args.parentId,
      type: args.type,
      visibility: args.visibility ?? "everyone",
      createdBy: ctx.auth.user._id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { id: folderId };
  },
});

export const updateFolder = adminMutation({
  args: {
    folderId: v.id("folders"),
    name: v.optional(v.string()),
    visibility: v.optional(v.union(v.literal("everyone"), v.literal("admin"))),
  },
  handler: async (ctx, args) => {
    const folder = await ctx.db.get(args.folderId);
    if (!folder || folder.organizationId !== ctx.auth.organization._id) {
      throw new ConvexError("Folder not found");
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) {
      const name = args.name.trim();
      if (!name) throw new ConvexError("Folder name cannot be empty");
      updates.name = name;
    }
    if (args.visibility !== undefined) {
      updates.visibility = args.visibility;
    }

    await ctx.db.patch(args.folderId, updates);
    return { success: true };
  },
});

export const deleteFolder = adminMutation({
  args: {
    folderId: v.id("folders"),
  },
  handler: async (ctx, args) => {
    const folder = await ctx.db.get(args.folderId);
    if (!folder || folder.organizationId !== ctx.auth.organization._id) {
      throw new ConvexError("Folder not found");
    }

    // Collect all descendant folder IDs (BFS)
    const toDelete: string[] = [args.folderId];
    const queue: string[] = [args.folderId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const children = await ctx.db
        .query("folders")
        .withIndex("by_parent", (q) => q.eq("parentId", currentId as never))
        .collect();
      for (const child of children) {
        toDelete.push(child._id);
        queue.push(child._id);
      }
    }

    // Orphan documents in all deleted folders (move to root)
    for (const fId of toDelete) {
      const docs = await ctx.db
        .query("documents")
        .withIndex("by_folder", (q) => q.eq("folderId", fId as never))
        .collect();
      for (const doc of docs) {
        await ctx.db.patch(doc._id, { folderId: undefined });
      }

      // Orphan templates too
      const templates = await ctx.db
        .query("templates")
        .withIndex("by_folder", (q) => q.eq("folderId", fId as never))
        .collect();
      for (const tmpl of templates) {
        await ctx.db.patch(tmpl._id, { folderId: undefined });
      }
    }

    // Delete all folders (children first, parent last)
    for (const fId of toDelete.reverse()) {
      await ctx.db.delete(fId as never);
    }

    return { success: true };
  },
});

export const moveToFolder = adminMutation({
  args: {
    folderId: v.id("folders"),
    newParentId: v.optional(v.id("folders")), // undefined = move to root
  },
  handler: async (ctx, args) => {
    const folder = await ctx.db.get(args.folderId);
    if (!folder || folder.organizationId !== ctx.auth.organization._id) {
      throw new ConvexError("Folder not found");
    }

    // Validate new parent
    if (args.newParentId) {
      const newParent = await ctx.db.get(args.newParentId);
      if (!newParent || newParent.organizationId !== ctx.auth.organization._id) {
        throw new ConvexError("Target folder not found");
      }
      if (newParent.type !== folder.type) {
        throw new ConvexError("Cannot move folder to a different type");
      }
    }

    // Prevent circular reference
    await detectCircularReference(ctx.db, args.folderId, args.newParentId);

    // Check depth won't exceed max after move
    const newDepth = args.newParentId
      ? (await getAncestorDepth(ctx.db, args.newParentId, 10)) + 1
      : 0;

    // Also check the subtree depth of the folder being moved
    async function getSubtreeDepth(fId: string): Promise<number> {
      const children = await ctx.db
        .query("folders")
        .withIndex("by_parent", (q) => q.eq("parentId", fId as never))
        .collect();
      if (children.length === 0) return 0;
      let max = 0;
      for (const child of children) {
        const d = await getSubtreeDepth(child._id);
        if (d + 1 > max) max = d + 1;
      }
      return max;
    }

    const subtreeDepth = await getSubtreeDepth(args.folderId);
    if (newDepth + subtreeDepth + 1 > 10) {
      throw new ConvexError("Move would exceed maximum nesting depth of 10");
    }

    await ctx.db.patch(args.folderId, {
      parentId: args.newParentId,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

export const moveItemsToFolder = adminMutation({
  args: {
    itemIds: v.array(v.string()),
    itemType: v.union(v.literal("document"), v.literal("template")),
    targetFolderId: v.optional(v.id("folders")), // undefined = move to root
  },
  handler: async (ctx, args) => {
    // Validate target folder if provided
    if (args.targetFolderId) {
      const targetFolder = await ctx.db.get(args.targetFolderId);
      if (!targetFolder || targetFolder.organizationId !== ctx.auth.organization._id) {
        throw new ConvexError("Target folder not found");
      }
      if (targetFolder.type !== args.itemType) {
        throw new ConvexError(`Cannot move ${args.itemType}s into a ${targetFolder.type} folder`);
      }
    }

    const table = args.itemType === "document" ? "documents" : "templates";
    for (const itemId of args.itemIds) {
      const item = await ctx.db.get(itemId as never);
      if (!item) continue;
      await ctx.db.patch(itemId as never, { folderId: args.targetFolderId });
    }

    return { success: true, moved: args.itemIds.length };
  },
});

export const togglePinFolder = adminMutation({
  args: {
    folderId: v.id("folders"),
  },
  handler: async (ctx, args) => {
    const folder = await ctx.db.get(args.folderId);
    if (!folder || folder.organizationId !== ctx.auth.organization._id) {
      throw new ConvexError("Folder not found");
    }

    await ctx.db.patch(args.folderId, {
      pinned: !folder.pinned,
      updatedAt: Date.now(),
    });

    return { pinned: !folder.pinned };
  },
});
```

**Step 2: Run typecheck**

Run: `bun --bun run typecheck`
Expected: Pass. If there are type issues with the `as never` casts on dynamic IDs, fix them by using proper typed references.

**Step 3: Commit**

```
feat(folders): add folder mutations — create, update, delete, move, pin
```

---

## Task 3: Create folder queries

**Files:**

- Create: `apps/backend/convex/folders/queries.ts`

**Step 1: Create the queries file**

```typescript
// apps/backend/convex/folders/queries.ts
import { ConvexError, v } from "convex/values";

import { authQuery } from "../auth";

export const listFolders = authQuery({
  args: {
    organizationId: v.id("organizations"),
    parentId: v.optional(v.id("folders")), // undefined = root
    type: v.union(v.literal("document"), v.literal("template")),
  },
  handler: async (ctx, args) => {
    const userId = ctx.auth.user._id;

    // Check membership for role-based visibility filtering
    const member = await ctx.db
      .query("organization_members")
      .withIndex("by_user_organization", (q) =>
        q.eq("userId", userId).eq("organizationId", args.organizationId),
      )
      .first();

    if (!member) throw new ConvexError("No access to this organization");

    const isAdminOrOwner = member.role === "admin" || member.role === "owner";

    // Query folders by parent
    const allFolders = await ctx.db
      .query("folders")
      .withIndex("by_org_type", (q) =>
        q.eq("organizationId", args.organizationId).eq("type", args.type),
      )
      .collect();

    // Filter by parentId (in-memory since Convex can't do optional index prefix + filter)
    const filtered = allFolders.filter((f) => {
      // Match parentId (undefined for root)
      if (args.parentId ? f.parentId !== args.parentId : f.parentId !== undefined) {
        return false;
      }
      // Visibility: everyone sees "everyone" folders, only admin/owner sees "admin" folders
      // Exception: creator always sees their own folders
      if (f.visibility === "admin" && !isAdminOrOwner && f.createdBy !== userId) {
        return false;
      }
      return true;
    });

    // Sort: pinned first, then alphabetical
    return filtered.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return a.name.localeCompare(b.name);
    });
  },
});

export const getFolderBreadcrumbs = authQuery({
  args: {
    folderId: v.id("folders"),
  },
  handler: async (ctx, args) => {
    const breadcrumbs: Array<{ id: string; name: string }> = [];
    let current = await ctx.db.get(args.folderId);
    let depth = 0;

    while (current && depth < 10) {
      breadcrumbs.unshift({ id: current._id, name: current.name });
      if (!current.parentId) break;
      current = await ctx.db.get(current.parentId);
      depth++;
    }

    return breadcrumbs;
  },
});

export const getFolder = authQuery({
  args: {
    folderId: v.id("folders"),
  },
  handler: async (ctx, args) => {
    const folder = await ctx.db.get(args.folderId);
    if (!folder) throw new ConvexError("Folder not found");
    return folder;
  },
});

/**
 * Get all folders for an org+type as a flat list.
 * Used by the "Move to folder" picker dialog to show a tree.
 */
export const getAllFoldersFlat = authQuery({
  args: {
    organizationId: v.id("organizations"),
    type: v.union(v.literal("document"), v.literal("template")),
  },
  handler: async (ctx, args) => {
    const userId = ctx.auth.user._id;
    const member = await ctx.db
      .query("organization_members")
      .withIndex("by_user_organization", (q) =>
        q.eq("userId", userId).eq("organizationId", args.organizationId),
      )
      .first();

    if (!member) throw new ConvexError("No access to this organization");
    const isAdminOrOwner = member.role === "admin" || member.role === "owner";

    const allFolders = await ctx.db
      .query("folders")
      .withIndex("by_org_type", (q) =>
        q.eq("organizationId", args.organizationId).eq("type", args.type),
      )
      .collect();

    return allFolders
      .filter((f) => {
        if (f.visibility === "admin" && !isAdminOrOwner && f.createdBy !== userId) {
          return false;
        }
        return true;
      })
      .map((f) => ({
        _id: f._id,
        name: f.name,
        parentId: f.parentId,
        pinned: f.pinned,
      }));
  },
});
```

**Step 2: Run typecheck**

Run: `bun --bun run typecheck`
Expected: Pass.

**Step 3: Commit**

```
feat(folders): add folder queries — list, breadcrumbs, getFolder, getAllFoldersFlat
```

---

## Task 4: Add folderId filter to existing document and template queries

**Files:**

- Modify: `apps/backend/convex/documents/queries.ts` (`listDocuments`)
- Modify: `apps/backend/convex/templates/queries.ts` (`getOrganizationTemplates`)

**Step 1: Add optional folderId arg to listDocuments**

In `apps/backend/convex/documents/queries.ts`, add to args:

```typescript
folderId: v.optional(v.id("folders")),
```

After the access filtering loop, add folder filtering:

```typescript
// Filter by folder if specified
const folderFiltered =
  args.folderId !== undefined
    ? accessibleDocuments.filter((doc) => doc.folderId === args.folderId)
    : accessibleDocuments;
```

Then use `folderFiltered` instead of `accessibleDocuments` for the rest of the function (workflow status filtering, return).

Also handle `folderId === null` case for "root only" (documents with no folder):

- If `args.folderId` is explicitly passed as `undefined` in the args object → show all docs (existing behavior)
- We add a separate `rootOnly` boolean arg: when `true`, filter to documents where `folderId` is `undefined`

Actually, simpler approach: add `rootOnly: v.optional(v.boolean())` arg. When `rootOnly` is true, filter to `doc.folderId === undefined`. When `folderId` is provided, filter to that folder. When neither, show all.

**Step 2: Add optional folderId arg to getOrganizationTemplates**

Same pattern — add `folderId: v.optional(v.id("folders"))` and `rootOnly: v.optional(v.boolean())` to args, filter in handler.

**Step 3: Run typecheck**

Run: `bun --bun run typecheck`
Expected: Pass.

**Step 4: Commit**

```
feat(folders): add folderId filtering to listDocuments and getOrganizationTemplates
```

---

## Task 5: Write folder tests

**Files:**

- Create: `apps/backend/convex/folders/__tests__/folders.test.ts`

**Test cases to cover:**

1. **createFolder** — creates root folder, creates nested folder, rejects empty name, rejects nesting > 10, rejects parent type mismatch
2. **updateFolder** — renames folder, changes visibility
3. **deleteFolder** — deletes folder + children recursively, orphans documents/templates to root
4. **moveToFolder** — moves to new parent, moves to root, rejects circular reference, rejects depth overflow
5. **moveItemsToFolder** — moves documents to folder, rejects type mismatch
6. **togglePinFolder** — toggles pinned state
7. **listFolders** — returns root folders, returns child folders, filters by visibility, sorts pinned first
8. **getFolderBreadcrumbs** — returns correct breadcrumb chain

**Step 1: Write the test file**

Use the same `createTestContext` pattern from `apps/backend/convex/test.setup.ts` as seen in `settings.test.ts`. Set up org + admin user + owner user in `beforeEach`.

**Step 2: Run tests**

Run: `cd apps/backend && bun --bun vitest run convex/folders/__tests__/folders.test.ts`
Expected: All tests pass.

**Step 3: Commit**

```
test(folders): add comprehensive tests for folder CRUD, move, pin, list, breadcrumbs
```

---

## Task 6: Install resizable panel and create folder sidebar component

**Files:**

- Create: `apps/web/src/components/folders/folder-sidebar.tsx`

**Step 1: Install shadcn resizable component**

Run: `cd apps/web && pnpx shadcn@latest add resizable`

**Step 2: Create the folder sidebar component**

The sidebar is a collapsible tree that:

- Fetches folders via `listFolders` query
- Renders a tree with expand/collapse chevrons
- Has a right-click context menu (Rename, Move, Pin/Unpin, Set Visibility, Delete)
- Has a "New Folder" button
- Highlights the currently active folder
- Calls `onFolderSelect(folderId | undefined)` when a folder is clicked

Props:

```typescript
interface FolderSidebarProps {
  organizationId: Id<"organizations">;
  type: "document" | "template";
  activeFolderId?: Id<"folders">;
  onFolderSelect: (folderId?: Id<"folders">) => void;
}
```

Key implementation details:

- Each folder node lazily loads children only when expanded
- Use `ContextMenu` from shadcn for right-click actions
- Inline rename via double-click (contentEditable or Input swap)
- "New Folder" creates at current tree level
- Delete shows confirmation AlertDialog

**Step 3: Run typecheck**

Run: `bun --bun run typecheck`
Expected: Pass.

**Step 4: Commit**

```
feat(folders): add folder sidebar tree component with context menu actions
```

---

## Task 7: Create breadcrumb and move-to-folder components

**Files:**

- Create: `apps/web/src/components/folders/folder-breadcrumbs.tsx`
- Create: `apps/web/src/components/folders/move-to-folder-dialog.tsx`

**Step 1: Create breadcrumbs component**

Uses `getFolderBreadcrumbs` query. Renders clickable segments. Root segment says "All Documents" or "All Templates" based on type prop.

Props:

```typescript
interface FolderBreadcrumbsProps {
  folderId: Id<"folders">;
  type: "document" | "template";
  onNavigate: (folderId?: Id<"folders">) => void;
}
```

**Step 2: Create move-to-folder dialog**

Modal with a folder tree picker. Uses `getAllFoldersFlat` query to get all folders, then builds a tree in-memory for the picker. Has a "Root" option at top. Optionally has a "New Folder" shortcut. On confirm, calls the provided `onMove(targetFolderId)` callback.

Props:

```typescript
interface MoveToFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: Id<"organizations">;
  type: "document" | "template";
  excludeFolderIds?: Id<"folders">[]; // For folder move — exclude self + descendants
  onMove: (targetFolderId?: Id<"folders">) => void;
}
```

**Step 3: Run typecheck**

Run: `bun --bun run typecheck`
Expected: Pass.

**Step 4: Commit**

```
feat(folders): add breadcrumb navigation and move-to-folder dialog
```

---

## Task 8: Integrate folder sidebar into documents page

**Files:**

- Modify: `apps/web/src/routes/_authenticated/$slug/documents/index.tsx`

**Step 1: Add folder state via URL search params**

Use TanStack Router's `searchParams` to read/write `folderId` from the URL:

```typescript
// In route definition, add search params validation
export const Route = createFileRoute("/_authenticated/$slug/documents/")({
  component: DocumentsPage,
  validateSearch: (search: Record<string, unknown>) => ({
    folderId: (search.folderId as string) || undefined,
  }),
  // ...
});
```

**Step 2: Wrap content in ResizablePanelGroup**

```tsx
<ResizablePanelGroup direction="horizontal">
  <ResizablePanel defaultSize={20} minSize={15} maxSize={35} collapsible>
    <FolderSidebar
      organizationId={organization._id}
      type="document"
      activeFolderId={folderId}
      onFolderSelect={handleFolderSelect}
    />
  </ResizablePanel>
  <ResizableHandle withHandle />
  <ResizablePanel defaultSize={80}>
    {/* Existing document list content */}
    {folderId && (
      <FolderBreadcrumbs folderId={folderId} type="document" onNavigate={handleFolderSelect} />
    )}
    {/* ... rest of page */}
  </ResizablePanel>
</ResizablePanelGroup>
```

**Step 3: Pass folderId to listDocuments query**

Add `folderId` and `rootOnly` to the query call. When user is at root (no folderId in URL), pass `rootOnly: false` (show all). When in a folder, pass `folderId`.

**Step 4: Add "Move to folder" to document context menu**

In the document row dropdown menu, add a "Move to folder..." option that opens the MoveToFolderDialog.

**Step 5: Run typecheck + build**

Run: `bun --bun run typecheck && bun --bun run build`
Expected: Pass.

**Step 6: Commit**

```
feat(folders): integrate folder sidebar into documents page
```

---

## Task 9: Integrate folder sidebar into templates page

**Files:**

- Modify: `apps/web/src/routes/_authenticated/$slug/templates.tsx`

Same integration pattern as Task 8 but for templates:

- Add `folderId` search param
- Wrap in ResizablePanelGroup with FolderSidebar (type="template")
- Add breadcrumbs
- Pass folderId to `getOrganizationTemplates` query
- Add "Move to folder" to template context menu

**Step 1-4: Mirror Task 8 for templates**

**Step 5: Run typecheck + build**

Run: `bun --bun run typecheck && bun --bun run build`
Expected: Pass.

**Step 6: Commit**

```
feat(folders): integrate folder sidebar into templates page
```

---

## Task 10: Run full static analysis and tests

**Step 1: Run all checks**

```bash
bun --bun run typecheck
bun --bun run lint
bun --bun run build
cd apps/backend && bun --bun vitest run convex/folders/__tests__/folders.test.ts
```

Expected: All pass.

**Step 2: Update roadmap**

In `docs/plans/2026-02-25-feature-execution-plan.md`, change Feature #2 status from `NOT STARTED` to `DONE`.

**Step 3: Commit**

```
chore: mark Feature #2 (Folders) as DONE in roadmap
```

---

## Verification Checklist

After all tasks complete:

1. `bun --bun run typecheck` — all workspaces pass
2. `bun --bun run lint` — 0 errors
3. `bun --bun run build` — all workspaces build
4. Folder tests pass with all cases
5. Manual verification (Playwright CLI):
   - Open documents page → folder sidebar visible
   - Create a folder → appears in sidebar
   - Create nested folder → appears under parent when expanded
   - Click folder → documents filtered, breadcrumbs shown
   - Right-click folder → context menu works (rename, pin, visibility, delete)
   - Move document to folder via context menu → document moves
   - Delete folder → children deleted, documents orphaned to root
   - Open templates page → same folder functionality works
