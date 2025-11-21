# Linear Tasks - Status Update Required

## Tasks to Mark as DONE ✅

The following 10 tasks have been **fully implemented and verified** in the codebase. They should be marked as "Done" in Linear:

### Backend/Database Tasks

1. **SEA-31** - Database Schemas (Signatures & Fields)
   - **Status**: Fully Complete
   - **Evidence**:
     - All tables defined in `apps/backend/convex/schema.ts`
     - signature_fields, signatures, document_recipients tables exist
     - All CRUD operations in respective mutations/queries files
   - **Commit**: `76ef292ba5b781b2438760ae0631b68d705ad7af`

2. **SEA-32** - Composite Queries for Related Data
   - **Status**: Fully Complete
   - **Evidence**:
     - `getDocumentWithSignatures` query exists
     - `getDocumentWithAuditTrail` query exists
     - `getDocumentFullContext` query exists
     - Location: `apps/backend/convex/documents/queries.ts:339-479`
   - **Commit**: `0302dd2688825bd6f88fdeb3f04197088b86c998`

### PDF & Document Management Tasks

3. **SEA-64** - PDF Preview & Metadata
   - **Status**: Fully Complete
   - **Evidence**:
     - `extractPdfMetadata()` function in `apps/web/src/lib/pdf-utils.ts`
     - Page count extraction implemented
     - Thumbnail generation implemented
     - Used in upload flow
   - **Commit**: `0343d5ccab17f69b5584995a5b4d67973aac89df`

4. **SEA-68** - Document Library with Table View
   - **Status**: Fully Complete
   - **Evidence**:
     - Table and grid view toggle exists
     - Sorting by name, date, status implemented
     - Pagination (20 items per page) working
     - Location: `apps/web/src/routes/_authenticated/$slug/documents/index.tsx:110-156`
   - **Commit**: `1eb9161e3ba301043fea9b72ef53d3af6af5fd08`

5. **SEA-69** - Document Thumbnails
   - **Status**: Fully Complete
   - **Evidence**:
     - Thumbnails generated during upload
     - Stored as `thumbnailDataUrl` in documents schema
     - Displayed in grid and table views
     - Location: `apps/web/src/components/documents/upload-dialog.tsx:102-109`
   - **Commit**: `cb4d2e60e4abdaee2f2509bb69df3e0881781d00`

6. **SEA-72** - Document Preview Page
   - **Status**: Fully Complete
   - **Evidence**:
     - Multi-page PDF viewer implemented
     - Document metadata display
     - Download functionality
     - Fillable PDF generation (added later)
     - Location: `apps/web/src/routes/_authenticated/$slug/documents/$documentId.tsx`
   - **Commits**: `16568095a2f7882b6c862de2048f2f085738111e`, `e6268b7913b00daf86280316247a829677f38aa4`

### Field Management Tasks

7. **SEA-84** - Konva Canvas Setup
   - **Status**: Fully Complete
   - **Evidence**:
     - Canvas layer over PDF using Konva
     - Zoom/pan integration with react-zoom-pan-pinch
     - Coordinate system sync working
     - Window resize handling implemented
     - Components: `pdf-canvas-layer.tsx`, `pdf-page-with-canvas.tsx`
   - **Commits**: `def59474d7275b789be4448bcc26e3f4241c5a02`, `50677a5f5db9265c3026d028f707287d62f2887e`, `62330ec7c7738d8120d51d86fb57ad6ebbec8487`, `0a72007dd62ce685d359dec751b805ccb69d18fc`

8. **SEA-89** - Field Toolbar with Drag-and-Drop
   - **Status**: Fully Complete
   - **Evidence**:
     - 7 field types supported: signature, text, date, checkbox, dropdown, radio, attachment
     - Drag-and-drop functionality working
     - Icons, labels, hints all implemented
     - Visual drag feedback
     - Location: `apps/web/src/components/documents/field-toolbar.tsx`
   - **Commit**: `e3ad971caf8123978c0cf5513e14fc2e31bb55dd`

9. **SEA-90** - Field Placement, Repositioning, and Resizing
   - **Status**: Fully Complete
   - **Evidence**:
     - Drop fields on PDF pages
     - Drag to reposition fields
     - Resize handles implemented
     - Precise coordinate conversion (percentages ↔ pixels)
     - Location: `apps/web/src/components/documents/draggable-field.tsx`
   - **Commit**: `43f4d54f8330f2fa76cfe7a0635e27f9c3e3c293`

10. **SEA-91** - Field Persistence to Database
    - **Status**: Fully Complete
    - **Evidence**:
      - createField, repositionField, deleteField mutations used
      - Load fields from database on page load
      - Optimistic UI updates
      - Delete confirmation dialog
      - Keyboard shortcuts (Delete/Backspace)
      - Location: `apps/web/src/routes/_authenticated/$slug/documents/$documentId.tsx:124-430`
    - **Commit**: `80b6829535baf5171365efeea5ed3c1eab6a65a8`

---

## Tasks That Should NOT Be Marked as Done ⚠️

### SEA-70 - Document Search
- **Status**: WAS complete but LOST in refactor
- **Issue**: Implemented in commit `c105b09` but removed when `documents.tsx` was split into layout file
- **Action Needed**: Re-implement search functionality in `documents/index.tsx`
- **Keep Status**: Todo or In Progress

### SEA-71 - Bulk Document Operations
- **Status**: WAS complete but LOST in refactor
- **Issue**: Implemented in commit `6f395ac` but removed in same refactor as SEA-70
- **Action Needed**: Re-implement bulk select/delete in `documents/index.tsx`
- **Keep Status**: Todo or In Progress

---

## How to Update in Linear

Since the Linear API authentication is not working in the local scripts, you'll need to update these manually:

### Option 1: Linear Web UI
1. Go to https://linear.app
2. Navigate to the Seal team
3. For each task (SEA-31, 32, 64, 68, 69, 72, 84, 89, 90, 91):
   - Find the issue
   - Update status to "Done"
   - Add a comment linking to the commit hash for verification

### Option 2: Linear CLI (if you have it configured)
```bash
# Example for SEA-31
linear issue update SEA-31 --status "Done"

# Repeat for: SEA-32, SEA-64, SEA-68, SEA-69, SEA-72, SEA-84, SEA-89, SEA-90, SEA-91
```

### Option 3: Fix API Key and Use Scripts
1. Get a new Linear API key from https://linear.app/settings/api
2. Update `.env.linear` in the project root
3. Run the update script:
```bash
cd /Users/gbarros/Developer/plasma/seal
# Create a script to update multiple issues at once
```

---

## Summary

- **10 tasks ready to mark as Done**: SEA-31, 32, 64, 68, 69, 72, 84, 89, 90, 91
- **2 tasks need re-implementation**: SEA-70, SEA-71
- **All verified with**: Code review + git commit history + working implementation
