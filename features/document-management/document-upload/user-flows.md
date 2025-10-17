                       ▍▍▍ SEAL LOGO ▍▍▍
     ╔══════════════════════════════════════════════════════════════════════════════════════════╗
     ║                        📎 DOCUMENT UPLOAD & STORAGE USER FLOWS                         ║
     ╚══════════════════════════════════════════════════════════════════════════════════════════╝

## Primary User Flows

### Multi-Format Document Upload Flow (Freemium Model)
[User Journey: Complete upload lifecycle with freemium model integration]
[Process Flow: Multi-format support with real-time conversion]

```
◉ User in Workspace Dashboard
    ┃
    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃                                                                 ┃
■━┨ Document Upload Initiation                                      ┃
    ┃ ┇━ Click "Upload Document" button                             ┃
    ┃ ┇━ See current document count (Free: "8/10 documents used")   ┃
    ┃ ┗━ Pro users see no limits                                    ┃
    ┃                                                                 ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
    ┃
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ [If Free Plan at Limit (10/10)]                                     ┃
┃    ┃                                                              ┃
┃    ■ Plan Upgrade Required                                         ┃
┃        ┇━ "You've reached your 10 document limit for this month" ┃
┃        ┇━ "Upgrade to Pro for unlimited documents"              ┃
┃        ┇━ "Start 2-week free trial" button                      ┃
┃        ┗━ "Your limit resets on [date]"                         ┃
┃                                                                     ┃
┃    [If User Upgrades] → Continue to upload                          ┃
┃    [If User Stays] → Return to dashboard                           ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
    ┃
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ [If Quota Available]                                                 ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
    ┃
◉ Document Selection Interface
    ┃
    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃                                                                 ┃
■━┨ Upload Method Choice                                            ┃
    ┃ ┇━ Drag & Drop Area                                           ┃
    ┃ │   ┇━ "Drag documents here or click to browse"             ┃
    ┃ │   ┗━ Visual feedback when dragging files over area        ┃
    ┃ ┇━ Browse Files Button                                        ┃
    ┃ │   ┇━ File picker opens                                    ┃
    ┃ │   ┗━ Filter shows: PDF, Word, Excel, PowerPoint, Images   ┃
    ┃ ┗━ Multiple file selection supported                          ┃
    ┃                                                                 ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
    ┃
◉ File Validation & Feedback
    ┃
    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃ ┇━ Supported formats: PDF, Word (.docx, .doc), Excel (.xlsx, .xls), PowerPoint (.pptx, .ppt), Images (PNG, JPEG)
    ┃ ┇━ File size limit: 50MB per document                       ┃
    ┃ ┇━ Invalid files show clear error messages                   ┃
    ┃ ┗━ Password-protected files rejected with instructions       ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
    ┃
■ Upload Progress & Processing
    ┃
    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃ ┇━ PDF files → Upload directly, ready immediately            ┃
    ┃ ┇━ Office/Image files → "Converting to PDF..." with progress bar ┃
    ┃ ┇━ Show estimated time for conversion                        ┃
    ┃ ┗━ Allow user to continue working while processing           ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
    ┃
◉ Upload Completion
    ├─ Success message: "Document uploaded successfully"
    ├─ Document appears in document list with preview thumbnail
    ├─ Free plan counter updates: "9/10 documents used"
    ├─ Document preview available for viewing
    └─ Ready for signature placement
```

### Batch Document Upload Experience

```
◉ User Selects Multiple Files (Mixed Formats)
    ┃
    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃                                                                 ┃
■━┨ Batch Upload Interface                                          ┃
    ┃ ┣━ Show all selected files with format icons                   ┃
    ┃ ┣━ Display total: "5 files selected"                           ┃
    ┃ ┣━ Show which files need conversion                            ┃
    ┃ ┗━ Estimate total processing time                               ┃
    ┃                                                                 ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
    ┃
◉ Batch Processing Experience
    ┃
    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃                                                                 ┃
■━┨ Multi-Document Processing                                       ┃
    ┃ ┣━ PDFs process immediately                                     ┃
    ┃ ┣━ Office/Image files show "Converting..." status              ┃
    ┃ ┣━ Overall progress: "3 of 5 documents completed"              ┃
    ┃ ┗━ User can navigate away and return later                     ┃
    ┃                                                                 ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
    ┃
■ Batch Completion Summary
    ├─ "All 5 documents uploaded successfully"
    ├─ OR "4 of 5 documents completed, 1 failed"
    ├─ Show failed files with retry option
    └─ Update document quota accordingly
```

### Document Upload Error & Recovery Flows

#### Upload Failure Recovery

```
◉ Upload Fails During Process
    ┃
    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃                                                                 ┃
■━┨ Error Message & Recovery Options                                ┃
    ┃ ┣━ "Upload failed. Here's what to try:"                        ┃
    ┃ ┣━ "Check your internet connection and try again"              ┃
    ┃ ┣━ "Try uploading a smaller file (max 50MB)"                   ┃
    ┃ ┣━ "Contact support if the problem persists"                   ┃
    ┃ ┗━ "Retry Upload" button                                        ┃
    ┃                                                                 ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
    ┃
◉ User Recovery Actions
    ├─ Retry → Restart upload process cleanly
    ├─ Different File → Clear current selection, choose new file
    ├─ Help → Link to support documentation
    └─ Cancel → Return to document dashboard
```

#### Document Conversion Issues

```
◉ Document Conversion Fails
    ┃
    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃                                                                 ┃
■━┨ Conversion Error Handling                                       ┃
    ┃ ┣━ "Document processing failed. Let's fix this:"               ┃
    ┃ ┣━ Explain specific issue (corrupted file, unsupported format) ┃
    ┃ ┣━ Suggest solutions (PDF repair tools, format conversion)     ┃
    ┃ ┗━ "Try Different File" option                                 ┃
    ┃                                                                 ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
    ┃
◉ User Options
    ├─ Upload different version of same document
    ├─ Convert document manually to PDF first
    ├─ Contact support with error details
    └─ Return to dashboard
```

#### Upload Interruption Handling

```
◉ User Navigates Away During Active Upload
    ┃
    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃                                                                 ┃
■━┨ Navigation Warning                                              ┃
    ┃ ┣━ "Upload in progress. Are you sure you want to leave?"       ┃
    ┃ ┣━ "Your document upload will be cancelled"                    ┃
    ┃ ┣━ "Stay on Page" (recommended)                                ┃
    ┃ ┗━ "Leave Page" (cancels upload)                               ┃
    ┃                                                                 ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
    ┃
[If User Stays]
    ┃
    ◉ Continue Upload Process
        └─ Upload resumes normally
    ┃
[If User Leaves]
    ┃
    ◉ Clean Upload Cancellation
        ├─ Stop file transfer
        ├─ Clean up temporary files
        ├─ Reset upload interface
        └─ No quota count impact
```

#### Upload Recovery After Page Reload

```
◉ User Refreshes/Returns to Page During Upload
    ┃
    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃                                                                 ┃
■━┨ Incomplete Upload Detection                                     ┃
    ┃ ┣━ "Previous upload was interrupted"                           ┃
    ┃ ┣━ "Would you like to start over?"                             ┃
    ┃ ┣━ "Start Fresh Upload" button                                 ┃
    ┃ ┗━ No recovery of partial upload (clean slate)                 ┃
    ┃                                                                 ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
    ┃
◉ Clean State Reset
    ├─ Clear any partial upload data
    ├─ Reset progress indicators
    ├─ Return to upload selection interface
    └─ Quota remains unchanged
```

---

## Document Organization & Management Flows

### Document Preview & Organization

```
◉ Successful Upload Completion
    ┃
    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃                                                                 ┃
■━┨ Document Preview Generation                                     ┃
    ┃ ┣━ Generate thumbnail for document list                        ┃
    ┃ ┣━ Create full document preview for viewing                    ┃
    ┃ ┣━ Extract page count and document information                 ┃
    ┃ ┗━ Make preview available immediately                          ┃
    ┃                                                                 ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
    ┃
◉ Document Organization Options
    ┃
    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃                                                                 ┃
■━┨ Organization & Metadata                                        ┃
    ┃ ┣━ Edit document name (defaults to filename)                   ┃
    ┃ ┣━ Add to folder (if using folder organization)               ┃
    ┃ ┣━ Add tags for easy searching                                 ┃
    ┃ ┗━ Set sharing preferences (private vs workspace)             ┃
    ┃                                                                 ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
    ┃
■ Document Preview Interaction
    ├─ Click document to view full preview
    ├─ Navigate through pages
    ├─ Zoom in/out functionality
    └─ Direct access to "Add Signature Fields"
```

### Duplicate Document Handling

```
◉ User Uploads Document with Existing Name
    ┃
    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃                                                                 ┃
■━┨ Duplicate Name Resolution                                       ┃
    ┃ ┣━ "A document named 'Contract.pdf' already exists"            ┃
    ┃ ┣━ Preview both documents                                       ┃
    ┃ ┣━ Options: "Replace existing", "Keep both", "Cancel"          ┃
    ┃ ┗━ If keep both → Auto-rename: "Contract (2).pdf"             ┃
    ┃                                                                 ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
    ┃
◉ User Decision Impact
    ├─ Replace → Original document moved to trash
    ├─ Keep both → Both documents available
    └─ Cancel → Return to upload interface
```

---

## Mobile Web Browser Experience

### Mobile-Responsive Upload Flow

```
◉ Mobile User Accesses Upload via Web Browser
    ┃
    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃                                                                 ┃
■━┨ Mobile Web Upload Interface                                    ┃
    ┃ ┣━ Touch-friendly file upload button                           ┃
    ┃ ┣━ Large "Browse Files" button for easy tapping               ┃
    ┃ ┣━ Clear file format guidance                                  ┃
    ┃ ┗━ Responsive layout for small screens                         ┃
    ┃                                                                 ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
    ┃
◉ Mobile Web Optimizations
    ├─ Simplified progress indicators
    ├─ Mobile-friendly error messages
    ├─ Optimized for thumb navigation
    └─ Fast loading on mobile connections
```

---

## Freemium Model Integration

### Free Plan Experience

```
◉ Free Plan User Document Management
    ┃
    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃                                                                 ┃
■━┨ Quota Awareness Throughout Experience                          ┃
    ┃ ┣━ Dashboard shows: "8 of 10 documents used this month"        ┃
    ┃ ┣━ Upload button shows remaining quota                         ┃
    ┃ ┣━ Proactive upgrade suggestions at 80% usage                  ┃
    ┃ ┗━ Clear limit reset date display                              ┃
    ┃                                                                 ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
    ┃
◉ Approaching Limit Notifications
    ├─ At 8/10: "2 documents remaining this month"
    ├─ At 9/10: "1 document remaining - consider upgrading"
    ├─ At 10/10: Upload blocked with upgrade options
    └─ Email notification when limit reached
```

### Pro Plan Experience

```
◉ Pro Plan User Upload Experience
    ┃
    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃                                                                 ┃
■━┨ Clean, Uncluttered Interface                                   ┃
    ┃ ┣━ No quota warnings or counters                               ┃
    ┃ ┣━ No upgrade prompts or badges                                ┃
    ┃ ┣━ Just the upload functionality they need                     ┃
    ┃ ┗━ Focus purely on getting work done                           ┃
    ┃                                                                 ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

---

## Integration with Document Workflow

### From Upload to Signature Flow

```
◉ Document Upload Complete
    ┃
    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃                                                                 ┃
■━┨ Next Steps Guidance                                            ┃
    ┃ ┣━ "Document ready! What would you like to do?"               ┃
    ┃ ┣━ "Add signature fields" (primary action)                    ┃
    ┃ ┣━ "Share with team members"                                   ┃
    ┃ ┣━ "Organize in folders"                                       ┃
    ┃ ┗━ "Return to dashboard"                                       ┃
    ┃                                                                 ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
    ┃
◉ Seamless Workflow Transition
    ├─ One-click transition to signature field placement
    ├─ Document preview loads immediately
    ├─ Upload success doesn't interrupt user flow
    └─ Background processing continues if needed
```

### Team Collaboration Integration

```
◉ Document Uploaded in Team Workspace
    ┃
    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃                                                                 ┃
■━┨ Team Sharing Options                                           ┃
    ┃ ┣━ "Keep private" (only creator can access)                    ┃
    ┃ ┣━ "Share with workspace" (all team members)                  ┃
    ┃ ┣━ "Share with specific members"                               ┃
    ┃ ┗━ Can change sharing later                                    ┃
    ┃                                                                 ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
    ┃
◉ Team Notifications
    ├─ Activity feed: "John uploaded 'Contract.pdf'"
    ├─ Shared documents appear in team document list
    ├─ Team members can comment and collaborate
    └─ Document ownership remains with uploader
```

This user flow focuses on the user experience, business logic, and decision points rather than technical implementation details.