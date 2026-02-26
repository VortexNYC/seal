# Folders — Design Document

> **Status:** NOT STARTED

## Goal

Allow users to organize documents and templates into a hierarchical folder structure with nested subfolders, drag-and-drop support, visibility controls, and pinning. This replaces the current flat list view with a navigable file-system-like experience.

## Current State

Today, documents and templates are displayed in flat lists filtered by organization. There is no grouping, nesting, or folder concept. Users with many documents rely solely on search and status filters to find what they need. Neither the `documents` nor `templates` table has a `folderId` field.

## Design

### User Flow

1. User sees a **folder tree sidebar** (or inline folder row) on the documents/templates list page
2. **Create folder**: Click "New Folder" button → enter name → folder appears in the tree
3. **Nest folders**: Drag a folder onto another folder, or use "Move to..." context menu
4. **Move documents/templates**: Select items → right-click or toolbar action → "Move to folder" picker dialog
5. **Pin folders**: Right-click → "Pin to top" — pinned folders always appear first in the sidebar
6. **Breadcrumb navigation**: When inside a folder, a breadcrumb bar shows `Root > Parent > Current` with clickable links
7. **Visibility**: Admins can set folder visibility to "everyone" (all org members see it) or "admin" (only admins and owners see it). The folder creator always sees their own folders regardless of visibility setting.

### Schema Changes

#### New Schema: `folders`

```
folders:
  organizationId: Id<"organizations">
  name: string
  parentId: v.optional(v.id("folders"))       // Self-referential — null means root level
  type: v.union(v.literal("document"), v.literal("template"))
  visibility: v.union(v.literal("everyone"), v.literal("admin"))
  pinned: v.optional(v.boolean())
  createdBy: v.id("users")
  createdAt: number
  updatedAt: number

  Indexes: by_organization, by_parent, by_org_type, by_org_created_by
```

#### Modify: `documents`

```typescript
// Add optional field
folderId: v.optional(v.id("folders"))
```

New index: `by_folder` on `["folderId"]`
Compound index: `by_org_folder` on `["organizationId", "folderId"]` (for folder-filtered document queries within an org)

#### Modify: `templates`

```typescript
// Add optional field
folderId: v.optional(v.id("folders"))
```

New index: `by_folder` on `["folderId"]`

### Backend Implementation

#### Mutations

- **`createFolder`** — Creates a folder. Validates: name non-empty, parentId (if provided) exists and belongs to same org, parent type matches the new folder's type, **nesting depth does not exceed 10** (walk ancestor chain to count depth before creating). Uses `permissionMutation("documents:create")` for document folders, `permissionMutation("templates:create")` for template folders.
- **`updateFolder`** — Rename or change visibility. Only creator or admin/owner can update.
- **`deleteFolder`** — Deletes a folder and handles children:
  - All child folders are recursively deleted
  - All documents/templates in deleted folders have their `folderId` set to `undefined` (moved to root, not deleted)
  - No guard on document status — documents in any status are simply moved to root (not deleted). The guard was too restrictive; folder deletion is an organizational action, not a document lifecycle action.
- **`moveToFolder`** — Moves a folder to a new parent (or to root if `parentId` is null). Includes **circular reference prevention**: traverses the ancestor chain of the target parent folder up to root; if any ancestor is the folder being moved, reject with error "Cannot move a folder into its own descendant."
- **`moveItemsToFolder`** — Moves one or more documents or templates into a folder. Validates type consistency (document items → document folder, template items → template folder).
- **`pinFolder`** / **`unpinFolder`** — Toggles the `pinned` boolean.

#### Queries

- **`listFolders`** — Lists folders for an organization, filtered by `parentId` (null = root) and `type`. Applies visibility filtering: returns folders where `visibility === "everyone"` OR `createdBy === currentUserId` OR user is admin/owner. Pinned folders sorted first.
- **`getFolderBreadcrumbs`** — Given a folderId, iteratively walks the `parentId` chain to build an ordered breadcrumb array `[{id, name}, ...]` from root to current. Iterative traversal (not recursive queries) — max depth of 10 to prevent runaway chains.
- **`listFolderContents`** — Returns documents or templates where `folderId` matches, combined with subfolders. This is the main query for rendering a folder's contents.

#### Circular Reference Prevention (Detail)

```
// Pseudocode for moveToFolder
function validateMove(folderId, newParentId):
  if newParentId is null: return OK  // Moving to root
  let current = newParentId
  let depth = 0
  while current is not null AND depth < 20:
    if current === folderId: throw "Circular reference detected"
    current = getFolder(current).parentId
    depth++
  return OK
```

### Frontend

#### Folder Sidebar Component

- Tree view component in the documents and templates list pages
- Collapsible folder nodes with expand/collapse chevrons
- Drag-and-drop support using `@dnd-kit/core` (already used in the field editor)
- Right-click context menu: Rename, Move, Pin/Unpin, Set Visibility, Delete
- "New Folder" button at the top of the sidebar

#### Breadcrumb Bar

- Rendered above the document/template list when user is inside a folder
- Each segment is a clickable link that navigates to that folder level
- Root segment labeled "All Documents" or "All Templates"

#### Move Dialog

- Modal with a folder tree picker (shows only compatible type folders)
- "New Folder" shortcut within the picker
- Supports multi-select: select several documents/templates, then "Move to..."

#### New Routes

No new routes needed — folders are a UI state within existing `/{slug}/documents` and `/{slug}/templates` pages, controlled by query parameter `?folderId=xxx`.

### Permissions

No new permissions needed. Folder creation/deletion follows existing `documents:create` / `templates:create` permissions. Visibility is an additional layer on top of permission checks.

### Plan Gating

| Feature | Free | Pro |
|---------|------|-----|
| Folders (flat, no nesting) | Yes — max 5 folders | Yes |
| Nested folders (unlimited depth) | No | Yes |
| Folder visibility controls | No (all folders visible to everyone) | Yes |
| Pinned folders | Yes | Yes |

### What We Skip (v1)

- No folder-level sharing (sharing is per-document, not per-folder)
- No folder colors or icons
- No folder-level bulk actions (e.g., "send all documents in folder")
- No folder templates (pre-configured folder structures)
- No cross-type folders (a folder is either for documents or templates, not both)
- No folder search (search still operates on document/template names globally)

### Key Files to Modify/Create

| File | Action |
|------|--------|
| `apps/backend/convex/schemas/folders.ts` | Create — folder table schema |
| `apps/backend/convex/schema.ts` | Modify — register folders table |
| `apps/backend/convex/schemas/documents.ts` | Modify — add optional `folderId` field and index |
| `apps/backend/convex/schemas/templates.ts` | Modify — add optional `folderId` field and index |
| `apps/backend/convex/folders/mutations.ts` | Create — CRUD, move, pin |
| `apps/backend/convex/folders/queries.ts` | Create — list, breadcrumbs, contents |
| `apps/web/src/components/folders/folder-sidebar.tsx` | Create — tree sidebar component |
| `apps/web/src/components/folders/folder-breadcrumbs.tsx` | Create — breadcrumb navigation |
| `apps/web/src/components/folders/move-to-folder-dialog.tsx` | Create — folder picker modal |
| `apps/web/src/routes/_authenticated/$slug/documents.tsx` | Modify — integrate folder sidebar and filtering |
| `apps/web/src/routes/_authenticated/$slug/templates.tsx` | Modify — integrate folder sidebar and filtering |
