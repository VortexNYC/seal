                       ▓▓▓ SEAL LOGO ▓▓▓
     ╔══════════════════════════════════════════════════════════════════════════════════════════╗
     ║                          📝 DOCUMENT TEMPLATES USER FLOWS                           ║
     ╚══════════════════════════════════════════════════════════════════════════════════════════╝

## Primary Template Creation Flows

### Create Template from Prepared Document Flow

```
◉ User Has Document Ready to Send (Fields Added, Recipients Assigned)
    ┃
    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃                                                                 ┃
■━┨ User Decides to Save as Template Before Sending               ┃
    ┃ ┣━ User sees "Save as Template" option alongside "Send for Signatures" ┃
    ┃ ┣━ Click "Save as Template" before sending document           ┃
    ┃ ┣━ Modal appears with template name field                     ┃
    ┃ ┗━ User enters template name and description                   ┃
    ┃                                                                 ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
    ┃
◉ Template Creation Complete
    ├─ "Template created successfully!" confirmation
    ├─ Template appears in template library
    ├─ User can now send original document or use new template later
    └─ Template completely independent from original document
```

### Create Template from Scratch Flow
```
○ User Wants to Build Reusable Template
    ↓
□ User Starts New Template Creation
    ├─ Click "Create New Template" in template library
    ├─ Upload base document (PDF without any fields)
    ├─ Template editor opens with clean document
    └─ User adds signature fields where needed
    ↓
○ User Completes Template Setup
    ├─ Add template name and description
    ├─ Define recipient roles (Client, Service Provider, etc.)
    ├─ Save template to library
    └─ Template ready for use
```

---

## Template Usage Flows

### Create New Document from Template Flow

```
◉ User Needs New Document Based on Existing Template
    ┃
    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃                                                                 ┃
■━┨ User Selects Template                                         ┃
    ┃ ┣━ Browse template library                                     ┃
    ┃ ┣━ Click template to see preview                              ┃
    ┃ ┣━ Click "Use This Template"                                   ┃
    ┃ ┗━ Template loads with all fields ready                        ┃
    ┃                                                                 ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
    ┃
◉ User Maps Template to Actual Recipients
    ├─ Assign real people to template roles
    ├─ Enter recipient names and email addresses
    ├─ Customize document if needed
    └─ Document ready for sending
    ┃
■ Template Application Complete
    ├─ New document created completely independent of template
    ├─ Document ready for sending to recipients
    ├─ Template remains unchanged for future use
    └─ No ongoing connection between document and template
```

### Template Discovery Flow
```
○ User Looking for Templates
    ↓
□ User Accesses Template Library
    ├─ Navigate to "Templates" section
    ├─ See all templates with previews
    ├─ Search templates by name
    └─ Filter by personal vs workspace templates
    ↓
○ User Reviews Available Templates
    ├─ Preview template structure
    ├─ Read template descriptions
    ├─ See template usage statistics
    └─ Choose template or create new one
```

---

## Template Management Flows

### Template Editing Flow

```
◉ User Wants to Improve Existing Template
    ┃
    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃                                                                 ┃
■━┨ User Opens Template for Editing                               ┃
    ┃ ┣━ Select template from library                                ┃
    ┃ ┣━ Click "Edit Template"                                       ┃
    ┃ ┣━ Template opens in editing mode                             ┃
    ┃ ┗━ User modifies fields and settings                          ┃
    ┃                                                                 ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
    ┃
◉ User Saves Template Changes
    ├─ "Save Template" confirms modifications
    ├─ Template updated in library
    ├─ Changes apply to future documents only
    └─ Existing documents remain unchanged
```

### Template Sharing Flow
```
○ User Creates Valuable Template for Team Use
    ↓
□ User Sets Template Sharing
    ├─ Open template sharing settings
    ├─ Change from "Private" to "Workspace Shared"
    ├─ Add description for team
    └─ Template becomes available to workspace
    ↓
○ Team Members Access Shared Template
    ├─ Template appears in "Workspace Templates"
    ├─ Team can use template for their documents
    ├─ Template usage tracked
    └─ Creator can see usage statistics
```

---

## Template Error Handling

### Template Creation Issues Flow
```
○ User Attempts Template Creation with Document Problems
    ↓
□ User Encounters Template Creation Issue
    ├─ "Template creation failed" error message
    ├─ Clear explanation of what went wrong
    ├─ Specific issues identified (e.g., "Document format not supported")
    └─ Recovery options presented
    ↓
○ User Chooses Recovery Option
    ├─ "Try Again" → Retry template creation
    ├─ "Edit Document First" → Fix document issues
    ├─ "Continue Without Template" → Send document without creating template
    └─ User can still accomplish their main goal
```

### Template Application Issues Flow
```
○ User Tries to Use Template with Problems
    ↓
□ User Sees Template Application Problem
    ├─ "Template couldn't be applied" error message
    ├─ Specific issue explanation
    ├─ Template remains available
    └─ Document creation stops gracefully
    ↓
○ User Resolves Issue
    ├─ "Try Different Template" → Browse other templates
    ├─ "Create Document Manually" → Build from scratch
    ├─ "Report Issue" → Help improve template
    └─ User still creates needed document
```

---

## Template Independence System

### Template Update Impact Flow

```
◉ User Updates Template That Has Been Used Before
    ┃
    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃                                                                 ┃
■━┨ Template Independence Maintained                               ┃
    ┃ ┣━ "Updating template..." message                             ┃
    ┃ ┣━ "Existing documents won't be affected" reassurance         ┃
    ┃ ┣━ Template changes apply only to future documents            ┃
    ┃ ┗━ Complete independence between templates and documents       ┃
    ┃                                                                 ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
    ┃
◉ Template Update Complete
    ├─ "Template updated successfully!"
    ├─ Updated template available for new documents
    ├─ All previously created documents unchanged
    └─ User can edit templates freely without worrying about existing documents
```

### Template Deletion Flow
```
○ User Wants to Delete Unused Template
    ↓
□ User Confirms Template Deletion
    ├─ "Delete template?" confirmation dialog
    ├─ "This won't affect any existing documents" reassurance
    ├─ Template usage statistics shown (if any)
    └─ Clear delete vs cancel options
    ↓
○ Template Deletion Complete
    ├─ Template removed from library
    ├─ All documents created from template remain unchanged
    ├─ No impact on existing documents or workflows
    └─ Clean template library maintained
```

---

## Mobile Template Experience

### Mobile Template Usage Flow
```
○ Mobile User Needs Document from Template
    ↓
□ Mobile Template Interface
    ├─ Touch-friendly template library
    ├─ Large template preview cards
    ├─ Simple template search
    └─ Easy template selection
    ↓
○ Mobile Template Application
    ├─ Touch-friendly recipient assignment
    ├─ Mobile-optimized field editing
    ├─ Simple template customization
    └─ Document creation works seamlessly on mobile
```

### Mobile Template Creation Flow
```
○ Mobile User Wants to Save Document as Template
    ↓
□ Mobile Template Creation
    ├─ "Save as Template" easily accessible
    ├─ Touch-friendly template setup
    ├─ Simple template naming
    └─ Template syncs across devices
    ↓
○ Mobile Template Complete
    ├─ Template created successfully
    ├─ Available immediately in library
    ├─ Consistent with desktop experience
    └─ Ready for use on any device
```

This simplified user flow documentation focuses on core template functionality without artificial restrictions, covering essential edge cases while maintaining clean user experience and template independence.