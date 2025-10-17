                       ▓▓▓ SEAL LOGO ▓▓▓
     ╔══════════════════════════════════════════════════════════════════════════════════════════╗
     ║                            📚 DOCUMENT LIBRARY USER FLOWS                              ║
     ╚══════════════════════════════════════════════════════════════════════════════════════════╝

## Primary Document Library Flows

### Main Document Library Access Flow

```
◉ User Navigates to Documents Section
    ┃
    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃                                                                 ┃
■━┨ Document Library Loading (Convex Real-time)                    ┃
    ┃ ┣━ Convex subscription establishes for workspace documents      ┃
    ┃ ┣━ Real-time document list populates instantly                 ┃
    ┃ ┣━ Document status indicators show current state               ┃
    ┃ ┗━ Access control enforced via Better Auth RBAC               ┃
    ┃                                                                 ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
    ┃
◉ Document Library Display
    ┃
    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃                                                                 ┃
■━┨ Document Library Interface                                     ┃
    ┃ ┣━ Grid/List view of all workspace documents                   ┃
    ┃ ┣━ Real-time status updates (draft, pending, completed)       ┃
    ┃ ┣━ Quick access to recent documents                            ┃
    ┃ ┗━ Search and filter options available                         ┃
    ┃                                                                 ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
    ┃
■ Document Interaction Options
    ├─ Click document → Preview and edit
    ├─ Right-click → Context menu (share, move, delete)
    └─ Drag and drop → Move to folders
```

### Document Search & Discovery Flow

```
◉ User Initiates Document Search
    ┃
    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃                                                                 ┃
■━┨ Real-time Search with fuzzysort                               ┃
    ┃ ┣━ Search query typed in search box                            ┃
    ┃ ┣━ fuzzysort searches live Convex data (<1ms)                  ┃
    ┃ ┣━ Results update instantly as user types                     ┃
    ┃ ┗━ Search highlights matching terms                            ┃
    ┃                                                                 ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
    ┃
◉ Search Results Display
    ├─ Matching documents shown with relevance ranking
    ├─ Search highlights in document names and content
    ├─ Filter options available (date, status, type)
    └─ Real-time updates continue during search
    ┃
■ Search Refinement
    ├─ Add filters to narrow results
    ├─ Sort results by date, relevance, status
    └─ Clear search to return to full library
```

### Document Organization Flow (Folders & Tags)

```
◉ User Wants to Organize Documents
    ┃
    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃                                                                 ┃
■━┨ Folder Management                                              ┃
    ┃ ┣━ Create new folder structure                                 ┃
    ┃ ┣━ Drag documents into folders                                ┃
    ┃ ┣━ Nested folder organization                                  ┃
    ┃ ┗━ Folder-based document filtering                             ┃
    ┃                                                                 ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
    ┃
◉ Tag Management
    ├─ Add tags to documents for categorization
    ├─ Create custom tag categories
    ├─ Filter documents by tags
    └─ Tag-based search
    ┃
■ Organization Benefits
    ├─ Improved document discovery
    ├─ Logical document grouping
    ├─ Enhanced search capabilities
    └─ Better workspace organization
```

---

## Document Status & Management Flows

### Document Status Tracking Flow

```
◉ Document Status Changes in Real-time
    ┃
    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃                                                                 ┃
■━┨ Status Update Propagation (Convex)                            ┃
    ┃ ┣━ Document status changes (draft → pending → completed)       ┃
    ┃ ┣━ Status updates propagate instantly to all users            ┃
    ┃ ┣━ Visual indicators update automatically                      ┃
    ┃ ┗━ Activity feed shows status changes                          ┃
    ┃                                                                 ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
    ┃
◉ Status-based Organization
    ├─ Filter documents by status
    ├─ Sort by status priority
    └─ Status-based notifications
    ┃
■ Workflow Integration
    ├─ Draft documents → Ready for signature fields
    ├─ Pending documents → Awaiting signatures
    ├─ Completed documents → Fully signed
    └─ Status drives next available actions
```

---

## Freemium Model Integration Flows

### Free Plan Document Library Experience

```
◉ Free Plan User Accesses Document Library
    ┃
    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃                                                                 ┃
■━┨ Quota-Aware Interface                                          ┃
    ┃ ┣━ Prominent quota display (8/10 documents used)              ┃
    ┃ ┣━ Monthly reset date shown clearly                            ┃
    ┃ ┣━ Upgrade suggestions at 80% usage (8/10)                    ┃
    ┃ ┗━ Clean interface focused on core functionality               ┃
    ┃                                                                 ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
    ┃
◉ Document Management with Limits
    ├─ All documents visible and manageable
    ├─ Full organization features available
    ├─ Search and filtering work normally
    └─ Sharing capabilities maintained
    ┃
■ Approaching Limit Behavior (9/10)
    ├─ "1 document remaining this month" notice
    ├─ Upgrade prompt in document actions
    ├─ All current documents remain accessible
    └─ Delete option to free up quota
```

### Free Plan Limit Reached Experience

```
◉ Free Plan User at Document Limit (10/10)
    ┃
    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃                                                                 ┃
■━┨ Limit Reached Interface                                        ┃
    ┃ ┣━ "Document limit reached" banner                             ┃
    ┃ ┣━ Upload button disabled with explanation                     ┃
    ┃ ┣━ All existing documents remain accessible                    ┃
    ┃ ┗━ Clear upgrade options presented                             ┃
    ┃                                                                 ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
    ┃
◉ Available Actions at Limit
    ├─ View and manage existing documents
    ├─ Delete documents to free up quota
    ├─ Download documents for backup
    ├─ Share existing documents
    └─ Organize existing documents
    ┃
■ Upgrade Path Options
    ├─ "Start 2-week Pro trial" → Immediate unlimited access
    ├─ "View Pro features" → Feature comparison
    ├─ "Limit resets [date]" → Wait for reset
    └─ Continue managing existing documents
```

### Pro Plan Document Library Experience

```
◉ Pro Plan User Document Library
    ┃
    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃                                                                 ┃
■━┨ Unlimited, Clean Interface                                     ┃
    ┃ ┣━ No quota counters or limits                                 ┃
    ┃ ┣━ No upgrade prompts or badges                                ┃
    ┃ ┣━ Focus purely on document management                         ┃
    ┃ ┗━ Advanced features available                                 ┃
    ┃                                                                 ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
    ┃
◉ Pro Plan Enhanced Features
    ├─ Advanced search and filtering
    ├─ Unlimited folders and tags
    ├─ Team collaboration features
    └─ Priority support for issues
```

---

## Document Discovery & Navigation Flows

### Recent Documents Quick Access

```
◉ User Needs Quick Access to Recent Work
    ┃
    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃                                                                 ┃
■━┨ Recent Documents Section                                       ┃
    ┃ ┣━ Last 10 accessed documents prominently displayed           ┃
    ┃ ┣━ Real-time updates as documents are accessed                ┃
    ┃ ┣━ Quick preview and action buttons                            ┃
    ┃ ┗━ Jump directly to document editing                           ┃
    ┃                                                                 ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
    ┃
◉ Smart Recent Document Logic
    ├─ Recently created documents
    ├─ Recently modified documents
    ├─ Recently viewed documents
    └─ Frequently accessed documents
    ┃
■ One-Click Access
    ├─ Click to open document preview
    ├─ Quick action buttons (edit, share, download)
    ├─ Context menu for additional options
    └─ Drag to folders for organization
```

### Advanced Search & Filtering Flow

```
◉ User Needs Specific Document Discovery
    ┃
    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃                                                                 ┃
■━┨ Multi-Criteria Search Interface                                ┃
    ┃ ┣━ Text search across document content                         ┃
    ┃ ┣━ Filter by document status                                   ┃
    ┃ ┣━ Filter by date range (created, modified)                   ┃
    ┃ ┣━ Filter by document type (PDF, converted docs)              ┃
    ┃ ┣━ Filter by folder location                                   ┃
    ┃ ┗━ Filter by assigned tags                                     ┃
    ┃                                                                 ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
    ┃
◉ Search Results Management
    ├─ Sort results by relevance, date, name, size
    └─ Clear search to return to full library
    ┃
■ Search Performance
    ├─ Instant results with fuzzysort (<1ms)
    ├─ Real-time updates as documents change
    ├─ Fuzzy matching for typos and partial matches
    └─ Searchable metadata and document content
```

---

## Document Sharing & Collaboration Flows

### Document Sharing from Library

```
◉ User Wants to Share Document from Library
    ┃
    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃                                                                 ┃
■━┨ Sharing Options Access                                         ┃
    ┃ ┣━ Right-click context menu → Share                           ┃
    ┃ ┣━ Document preview → Share button                            ┃
    ┃ ┗━ Quick share button in list view                             ┃
    ┃                                                                 ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
    ┃
◉ Sharing Method Selection
    ├─ Share with workspace members
    ├─ Create secure sharing link
    ├─ Send for signature via email
    └─ Export and share externally
    ┃
■ Sharing Configuration
    ├─ Set access permissions (view, edit, comment)
    ├─ Add sharing message or context
    ├─ Set expiration date for shared links
    └─ Track sharing activity and access
```

### Team Collaboration in Document Library

```
◉ Team Member Activity in Shared Library
    ┃
    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃                                                                 ┃
■━┨ Real-time Collaboration Indicators                             ┃
    ┃ ┣━ Show who is currently viewing documents                     ┃
    ┃ ┣━ Display recent activity by team members                    ┃
    ┃ ┣━ Highlight documents with pending actions                    ┃
    ┃ ┗━ Activity feed integration                                   ┃
    ┃                                                                 ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
    ┃
◉ Collaborative Document Management
    ├─ Team members can organize shared documents
    ├─ Collaborative tagging and folder management
    ├─ Shared document status updates
    └─ Team notifications for document changes
    ┃
■ Permission-Based Access
    ├─ Different permission levels (view, edit, admin)
    ├─ Workspace-level document access control
    ├─ Individual document sharing permissions
    └─ Real-time permission enforcement
```

---

## Mobile Document Library Experience

### Mobile Library Navigation Flow

```
◉ Mobile User Accesses Document Library
    ┃
    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃                                                                 ┃
■━┨ Mobile-Optimized Interface                                     ┃
    ┃ ┣━ Touch-friendly document grid/list                          ┃
    ┃ ┣━ Swipe gestures for quick actions                            ┃
    ┃ ┣━ Mobile search with autocomplete                             ┃
    ┃ ┗━ Simplified navigation structure                             ┃
    ┃                                                                 ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
    ┃
◉ Mobile Document Interactions
    ├─ Tap to preview documents
    ├─ Long press for context menu
    ├─ Pull-to-refresh for updates
    └─ Mobile sharing options
    ┃
■ Mobile Organization Features
    ├─ Simple folder navigation
    ├─ Tag-based filtering
    └─ Offline document access (cached)
```

---

## Error Handling & Connection Management

### Connection Loss Recovery Flow

```
◉ Real-time Connection Lost During Library Use
    ┃
    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃                                                                 ┃
■━┨ Graceful Degradation (Convex)                                  ┃
    ┃ ┣━ Show cached document list                                   ┃
    ┃ ┣━ Indicate connection status                                  ┃
    ┃ ┣━ Queue actions for when connection returns                  ┃
    ┃ ┗━ Automatic reconnection attempts                             ┃
    ┃                                                                 ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
    ┃
◉ Connection Recovery
    ├─ Restore real-time subscriptions
    ├─ Sync any missed updates
    ├─ Execute queued actions
    └─ Resume normal functionality
    ┃
■ User Communication
    ├─ Subtle "Offline" indicator
    ├─ "Reconnecting..." status
    ├─ "Connection restored" confirmation
    └─ No data loss during interruption
```

This focused user flow documentation covers the essential document library functionality without the bulk operations complexity we don't need right now.