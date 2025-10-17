                       ▓▓▓ SEAL LOGO ▓▓▓
     ╔══════════════════════════════════════════════════════════════════════════════════════════╗
     ║                    📁 FEATURE #4: DOCUMENT UPLOAD & STORAGE                             ║
     ╚══════════════════════════════════════════════════════════════════════════════════════════╝

## Feature Requirements (from MVP Core Features)

### Document Upload & Storage ⭐ **Critical**

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                                 CORE REQUIREMENTS                                      ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

◉ **Multi-format upload** with drag-and-drop interface (PDF, Word, Excel, PowerPoint)
◉ **Automatic document conversion** to PDF via Chromiumly
◉ **File validation** (size limits, format checking)
◉ **Cloud storage integration** (secure file handling)
◉ **Document preview** in browser
◉ **File organization** (folders/tags)

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                            TECHNOLOGY STACK INTEGRATION                                ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

╭─ Frontend & Interface ─────────────────────────────────────────────────────────────────╮
│ • **TanStack Start**: Server-side rendering and API routes                            │
│ • **React**: Drag-and-drop upload interface                                           │
│ • **react-pdf**: PDF preview and viewing                                              │
╰────────────────────────────────────────────────────────────────────────────────────────╯

╭─ Processing & Conversion ──────────────────────────────────────────────────────────────╮
│ • **Chromiumly**: Document conversion library (TypeScript wrapper for Gotenberg)     │
│ • **Fly.io**: Gotenberg Docker container hosting for document conversion             │
│ • **Zod**: File validation and schema validation                                      │
╰────────────────────────────────────────────────────────────────────────────────────────╯

╭─ Storage & Backend ────────────────────────────────────────────────────────────────────╮
│ • **Convex**: File storage and document management                                    │
│ • **File size limits**: 50MB maximum per document                                     │
│ • **Conversion timeout**: 60-second timeout for document conversion                   │
╰────────────────────────────────────────────────────────────────────────────────────────╯

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                                BUSINESS REQUIREMENTS                                    ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

■ Secure file storage with workspace-level access control
■ Fast upload experience with progress indicators  
■ Seamless multi-format document conversion to PDF
■ Reliable file validation before processing and conversion
■ Mobile-responsive upload interface
■ Freemium model integration (10 docs/month for Free plan)

╔══════════════════════════════════════════════════════════════════════════════════════════╗
║                           🔧 EDGE CASES & ERROR HANDLING                                ║
╚══════════════════════════════════════════════════════════════════════════════════════════╝

### Convex File Storage Integration
- **File Upload**: Convex file storage for final PDF documents
- **Security**: Workspace-scoped access controls via Better Auth RBAC
- **Processing**: Multi-format conversion + PDF validation and metadata extraction
- **Storage Limits**: Unlimited storage per workspace (Pro plans), 10 docs/month (Free plan)
- **File Organization**: Document categorization and search capabilities

### Document Upload Workflow States & Edge Cases

#### Happy Path Upload Workflow
1. **Plan Quota Check**: Verify Free plan document limit (10/month) or Pro unlimited
2. **Upload Interface**: Drag-and-drop or file picker interface
3. **File Selection**: User selects document (PDF, Word, Excel, PowerPoint, images)
4. **Upload Progress**: Progress indicator during file transfer to Vercel
5. **File Validation**: Format and size validation (50MB limit)
6. **Document Conversion**: Automatic conversion to PDF via Chromiumly + Fly.io Gotenberg
7. **Processing**: PDF parsing and metadata extraction
8. **Storage**: Secure PDF storage in Convex with workspace context
9. **Document Ready**: Available for signature field placement

#### File Upload Method Edge Cases
- [ ] **Drag & Drop Upload**: Standard drag-and-drop interface
  - Success: Visual feedback during drag, progress on drop
  - File Preview: Show document thumbnail after upload (mobile-responsive)
- [ ] **File Picker Upload**: Traditional file selection dialog
  - Filters: Only show PDF files in picker
  - Multiple Selection: Handle if user selects multiple files
- [ ] **Upload Interruption**: User navigates away during upload
  - Warning: "Upload in progress. Are you sure you want to leave?"
  - Recovery: Resume upload if possible, or restart
- [ ] **Network Issues**: Connection drops during upload
  - Retry: Automatic retry mechanism with exponential backoff
  - User Feedback: "Upload failed. Retrying..." with retry count

#### Manual Error Recovery Workflows (Upload & Processing)
- [ ] **Upload failure recovery**: Help users recover from failed uploads
  - Clear error message: "Upload failed. Here's what to try:"
  - Step 1: "Check your internet connection and try again"
  - Step 2: "Try uploading a smaller file (max 50MB)"
  - Step 3: "Contact support if the problem persists"
  - "Retry Upload" button that restarts the process cleanly
- [ ] **Processing failure recovery**: Handle document processing errors
  - Error message: "Document processing failed. Let's fix this:"
  - Specific error explanation (corrupted PDF, invalid format, etc.)
  - Alternative solutions (PDF repair tools, format conversion)
  - "Try Different File" option to restart upload process
  - Technical support option with error details included
- [ ] **Partial upload recovery**: Handle incomplete uploads
  - Detect incomplete upload on page reload
  - Show "Previous upload was interrupted. Start over?"
  - Clear any partial upload data before allowing new upload
  - Progress reset to ensure clean state

#### Supported File Formats (Chromiumly + Gotenberg)
- [ ] **PDF Files**: Direct upload and processing
  - Native PDF files → Direct storage and processing
  - Password-protected PDFs → Error with removal instructions
- [ ] **Microsoft Office Documents**: Auto-conversion via LibreOffice
  - Word documents (.docx, .doc) → PDF conversion
  - Excel spreadsheets (.xlsx, .xls) → PDF conversion
  - PowerPoint presentations (.pptx, .ppt) → PDF conversion
- [ ] **Image Files**: Auto-conversion to PDF
  - PNG, JPEG, GIF, BMP → PDF conversion
  - Maintains image quality and aspect ratio
- [ ] **Other Formats**: Additional LibreOffice-supported formats
  - OpenDocument formats (ODT, ODS, ODP)
  - Rich Text Format (RTF)
  - See Gotenberg documentation for complete list

#### File Validation Edge Cases
- [ ] **Valid Supported File**: Document in supported format
  - PDF: Parse PDF structure, extract page count and metadata
  - Office/Image: Queue for conversion via Chromiumly
  - Success: Proceed to processing or conversion
- [ ] **Invalid File Format**: Unsupported file format
  - Error: "File format not supported. Supported formats: PDF, Word, Excel, PowerPoint, Images"
  - Suggestions: List of supported formats with examples
- [ ] **Corrupted File**: File with damaged structure
  - Error: "File appears to be corrupted. Please try a different file."
  - Recovery: Suggest re-saving or using file repair tools
- [ ] **Password-Protected Files**: Files with encryption/security
  - Error: "Password-protected files cannot be processed. Please remove protection first."
  - Help: Instructions for removing password protection
- [ ] **Empty Files**: Files with no content or pages
  - Error: "File has no content. Please check your document."
- [ ] **File Size Limit**: File size exceeds 50MB limit (consistent across all features)
  - Error: "File too large (max 50MB). Please compress your file or split into smaller files."
  - Conversion Timeout: 60 seconds maximum for document conversion
  - Processing Timeout: 30 seconds maximum for PDF processing
  - Suggestions: File compression tool recommendations

### Document Storage and Organization Edge Cases

#### Workspace Storage Context
- [ ] **Document Ownership**: Documents belong to specific workspace
  - Access: Only workspace members can view/edit documents
  - Isolation: Documents not visible across different workspaces
- [ ] **Unlimited Storage**: No storage limits per workspace
  - Competitive: Match market leaders (DocuSign, PandaDoc, Dropbox Sign)
  - Cost Management: Monitor usage, adjust if needed based on actual costs

#### Document Metadata and Organization
- [ ] **Auto-Generated Metadata**: Extract information from PDF
  - Title: Use PDF title metadata or filename
  - Pages: Count total pages for display
  - Size: File size for storage tracking
  - Created: Upload timestamp with timezone
- [ ] **Filename Handling**: Process uploaded filenames
  - Special Characters: Handle Unicode, spaces, special symbols
  - Duplicate Names: Auto-append numbers for conflicts "Document (2).pdf"
  - Very Long Names: Truncate display while preserving full name
- [ ] **Document Categorization**: Optional folder/tag organization
  - Folders: Simple folder structure for document organization
  - Tags: Label documents with custom tags
  - Search: Enable searching by filename, tags, content
- [ ] **Document Versions**: Handle document updates/replacements
  - Version Control: Keep previous versions when document updated
  - Replacement: "Replace existing document?" when same filename uploaded
  - History: Track document modification history

### Document Access Control Edge Cases

#### Workspace Member Access
- [ ] **Document Creator**: User who uploaded document has full access
  - Permissions: Edit, delete, share, send for signature
- [ ] **Workspace Admin**: Admin role access to all workspace documents
  - Permissions: Same as creator for all documents in workspace
- [ ] **Workspace Member**: Regular member access to documents
  - Permissions: View documents shared with them, participate in signing
- [ ] **Document Sharing**: Creator shares document with specific members
  - Granular: Choose which workspace members can access specific documents
  - Notifications: Notify members when documents shared with them

#### Cross-Workspace Access Control
- [ ] **Workspace Isolation**: Documents strictly scoped to workspace
  - Security: No cross-workspace document access
  - User in Multiple Workspaces: Must switch workspace context to access documents
- [ ] **User Leaves Workspace**: Member removed from workspace
  - Effect: Lose access to all workspace documents immediately
  - Documents They Created: Remain in workspace, ownership transfers to admin
- [ ] **Workspace Deletion**: Entire workspace deleted
  - Documents: All documents in workspace deleted (with grace period)
  - Recovery: 90-day recovery period for workspace and documents

### Document Processing and Preview Edge Cases

#### Simplified PDF Processing (All PDFs Supported)
- [ ] **Any PDF Processing**: All PDFs should preview regardless of size, complexity, scanned/text
  - Success: Generate preview for any valid PDF
  - Fallback: If preview fails, show error but don't block functionality
  - No Special Cases: Remove complex PDF, large PDF, scanned PDF distinctions
- [ ] **Standard Processing Path**: One processing workflow for all PDFs
  - Parse: Extract text content for search capability (when available)
  - Preview: Generate thumbnail images for document preview
  - Pages: Create individual page previews for signature field placement
- [ ] **Processing Failure**: PDF parsing fails for any reason
  - Fallback: Store document but with limited functionality
  - Error: "Document uploaded but preview unavailable. You can still add signature fields."
  - Recovery: Retry processing option

#### Document Search and Discovery (Simplified)
- [ ] **Metadata Search**: Search by filename, creator, date, tags, status
  - Implementation: Straightforward database queries
  - Filters: Filter documents by date, creator, status
  - Sorting: Sort by name, date, size, status
- [ ] **Text Content Search**: PDF text extraction and search
  - Implementation: Use pdf-ts library for text extraction
  - Indexing: Extract and index text content for search capability
  - Results: Highlight search results within document pages
- [ ] **No Search Results**: Search query returns no matches
  - Feedback: "No documents found matching your search"
  - Suggestions: Search tips, clear filters option
- [ ] **Search Performance**: Optimized for workspace document volumes
  - Optimization: Pagination, lazy loading, indexed search
  - Performance: Fast search response for typical workspace sizes