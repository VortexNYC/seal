                       ▓▓▓ SEAL LOGO ▓▓▓
     ╔══════════════════════════════════════════════════════════════════════════════════════════╗
     ║                          📚 FEATURE #6: DOCUMENT LIBRARY                             ║
     ╚══════════════════════════════════════════════════════════════════════════════════════════╝

## Feature Requirements (from MVP Core Features)

### Document Library ⚡ **Important**

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                                 CORE FEATURES                                          ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

◉ **Document listing** with search and filters
◉ **Recent documents** quick access
◉ **Document status** indicators (draft, pending, completed)
◉ **Bulk operations** (delete, archive, move to folder)
◉ **Document sharing** via secure links
◉ **Folder organization** with nested folder support
◉ **Tag management** for document categorization
◉ **Freemium quota display** (Free plan document sending count)

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                            TECHNOLOGY STACK INTEGRATION                                ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

╭─ Real-time Data Layer ───────────────────────────────────────────────────────────────╮
│ • **Convex**: Real-time queries, subscriptions, and live document updates            │
│ • **fuzzysort**: Client-side search on live Convex data (5KB, <1ms on 13k files)    │
╰────────────────────────────────────────────────────────────────────────────────────────╯

╭─ User Interface ───────────────────────────────────────────────────────────────────╮
│ • **TanStack Start**: Server-side rendering and API routes for document library     │
│ • **React**: Component state management and loading indicators                       │
╰────────────────────────────────────────────────────────────────────────────────────────╯

╭─ Security & Access Control ─────────────────────────────────────────────────────────╮
│ • **Better Auth RBAC**: Workspace-scoped access control for document visibility     │
╰────────────────────────────────────────────────────────────────────────────────────────╯

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                                BUSINESS REQUIREMENTS                                    ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

■ Fast document discovery and navigation
■ Clear visual status indicators for all document states
■ Workspace-level document organization
■ Secure document sharing capabilities
■ Freemium model integration (Free: 10 docs/month sending limit, Pro: unlimited + API + multi-user)
■ Folder and tag organization for better document management
■ Mobile-responsive document library experience

---

## Freemium Model Integration

### Free Plan Document Library
- Display document quota prominently (8/10 documents used)
- Show upgrade prompts when approaching limit (at 80% usage)
- Block document sending when limit reached
- Clear monthly reset date display
- Full access to all library features (folders, tags, bulk operations, search)

### Pro Plan Document Library  
- Clean interface without quota counters or upgrade prompts
- Unlimited document sending
- API access for document management
- Multiple workspace users support

### Document Organization Features
- **Folders**: Hierarchical folder structure for document organization
- **Tags**: Flexible tagging system for document categorization  
- **Search**: Full-text search across document content and metadata
- **Filters**: Filter by date, status, type, folder, tags
- **Sorting**: Sort by name, date, size, status, recent activity

╔══════════════════════════════════════════════════════════════════════════════════════════╗
║                           🔧 EDGE CASES & ERROR HANDLING                                ║
╚══════════════════════════════════════════════════════════════════════════════════════════╝

### Document Library Workflow States & Edge Cases

#### Happy Path Document Library Workflow
1. **Library Access**: User navigates to document library in current workspace
2. **Convex Subscription**: Real-time subscription to workspace documents
3. **Live Document List**: Documents appear with live status updates via Convex
4. **Client-side Search**: fuzzysort searches through live Convex data
5. **Real-time Actions**: Document actions update immediately via Convex mutations
6. **Live Status Updates**: Document status changes propagate instantly to all users

#### Convex Document Loading & Real-time Subscriptions Edge Cases
- [ ] **Convex Subscription Success**: Real-time subscription to workspace documents established
  - Live Data: Documents appear immediately with current status (draft, pending, completed)
  - Real-time Updates: Document changes propagate instantly to UI
  - Access Control: Better Auth RBAC filters documents in Convex query
- [ ] **Convex Connection Failure**: Initial connection to Convex fails
  - Error State: "Unable to load documents. Checking connection..."
  - Retry Logic: Convex automatic reconnection with exponential backoff
  - React State: Component loading states and error handling for connection attempts
- [ ] **Convex Subscription Interruption**: Real-time subscription drops mid-session
  - Detection: Convex client detects subscription loss
  - Reconnection: Automatic resubscription with state recovery
  - User Feedback: Subtle indicator showing "Reconnecting..." status
- [ ] **Large Document Collections**: Workspace with thousands of documents
  - Convex Pagination: Use Convex paginated queries with cursor-based pagination
  - Live Updates: Even paginated data receives real-time updates
  - Performance: Convex handles large datasets efficiently server-side
- [ ] **Empty Workspace**: No documents in current workspace
  - Empty State: Real-time query returns empty array immediately
  - User Onboarding: "Upload your first document to get started"
  - Live Updates: New document uploads appear instantly via subscription

#### React State Management with Convex Edge Cases
- [ ] **React + Convex Pattern**: Proper integration with Convex's automatic caching
  - Loading States: React useState and useEffect for component loading states
  - Error Handling: React error boundaries for Convex query failures
  - DevTools: Convex DevTools for development debugging
- [ ] **Component State Management**: Handle React component states with live Convex data
  - Loading: Show skeleton UI while Convex subscription initializes
  - Error: Display error states when Convex queries fail
  - Success: Seamless transition to live data once subscription established
- [ ] **Background Refetching Disabled**: Prevent conflicts with Convex real-time data
  - Configuration: Disable background refetching since Convex provides live updates
  - Focus Refetch: Disable refetch on window focus (Convex data already fresh)
  - Interval Refetch: No polling needed with Convex subscriptions
- [ ] **React Error Boundaries**: Handle Convex query failures gracefully
  - Query Errors: React error boundaries catch Convex query failures
  - Error Recovery: Retry mechanisms work with Convex reconnection
  - User Experience: Clean error states without losing application state

#### Client-side Search with Live Data (fuzzysort) Edge Cases
- [ ] **Search on Live Convex Data**: fuzzysort searches real-time document array
  - Data Source: fuzzysort operates on current Convex subscription data
  - Live Search: Search results update automatically as documents change
  - Performance: fuzzysort <1ms search even on large live datasets
- [ ] **Real-time Search Updates**: Document changes affect search results immediately
  - Document Added: New documents matching search appear instantly
  - Document Modified: Title/metadata changes update search results live
  - Document Removed: Deleted documents disappear from search results immediately
- [ ] **Search Query Processing**: fuzzysort handles various search patterns
  - Multi-field Search: Search across title, filename, tags simultaneously
  - Fuzzy Matching: "agreem" matches "Agreement", partial matching
  - Diacritics: Automatic accent handling (résumé matches resume)
  - Real-time Highlighting: Search highlights update as data changes
- [ ] **Search Performance with Live Data**: Maintain performance with changing datasets
  - Memory Efficiency: fuzzysort doesn't store separate indexes (works on live array)
  - Update Performance: Search performance unaffected by live data updates
  - Large Dataset Search: Maintain <1ms performance even with thousands of documents
- [ ] **Search State Persistence**: Maintain search while data updates live
  - Search Persistence: Keep search active while documents update in background
  - Result Consistency: Search results remain stable during live updates
  - Filter Persistence: Maintain search filters across real-time data changes

#### Convex Real-time Document Status Updates Edge Cases
- [ ] **Live Status Propagation**: Document status changes propagate via Convex subscriptions
  - Instant Updates: Status changes visible across all user sessions immediately
  - Multiple Users: All workspace members see status updates in real-time
  - Optimistic Updates: Convex provides optimistic updates for immediate feedback
- [ ] **Status Update Conflicts**: Multiple users modify same document simultaneously
  - Convex Conflict Resolution: Server-side conflict resolution maintains consistency
  - Optimistic UI: UI updates optimistically, resolves conflicts automatically
  - User Notification: Optional notification when conflicts are resolved
- [ ] **Subscription Persistence**: Maintain real-time updates during user interactions
  - Background Updates: Status updates continue while user interacts with other documents
  - Multi-tab Sync: Status updates sync across multiple browser tabs
  - Session Persistence: Real-time updates persist across page refreshes
- [ ] **Live Status Accuracy**: Ensure status indicators reflect actual document state
  - Server Truth: Convex server is source of truth for document status
  - Immediate Consistency: Status changes reflect immediately without delay
  - Cross-user Consistency: All users see identical status at all times

#### Document Actions with Convex Mutations Edge Cases
- [ ] **Convex Mutation Success**: Document actions execute via Convex mutations
  - Optimistic Updates: Actions appear successful immediately in UI
  - Server Confirmation: Convex confirms mutation success/failure
  - Live Propagation: Action results propagate to all connected users
- [ ] **Mutation Permission Errors**: Better Auth RBAC prevents unauthorized actions
  - Client-side Prevention: Hide actions user doesn't have permission for
  - Server-side Validation: Convex mutations validate permissions server-side
  - Error Handling: Clear error messages when permissions insufficient
- [ ] **Concurrent Mutation Conflicts**: Multiple users act on same document
  - Convex Handling: Server resolves concurrent mutations appropriately
  - User Feedback: Clear indication when another user is modifying document
  - Conflict Resolution: Automatic resolution with user notification if needed
- [ ] **Mutation Failure Recovery**: Handle failed Convex mutations gracefully
  - Optimistic Rollback: UI rolls back optimistic changes on mutation failure
  - Retry Logic: Allow user to retry failed actions
  - Error States: Clear error messages with actionable retry options
- [ ] **Bulk Operations via Convex**: Handle multiple document operations
  - Batch Mutations: Group multiple actions into efficient Convex mutations
  - Progress Tracking: Show progress for bulk operations
  - Partial Failures: Handle cases where some operations succeed, others fail

#### Workspace Context & Access Control Edge Cases
- [ ] **Workspace-scoped Queries**: Convex queries filtered by current workspace
  - Automatic Scoping: All document queries automatically scoped to active workspace
  - Context Switching: Document list updates immediately when switching workspaces
  - Access Validation: Better Auth RBAC validates workspace access server-side
- [ ] **Real-time Permission Changes**: Permission updates propagate via Convex
  - Permission Revocation: Documents disappear immediately when access revoked
  - Permission Grants: New documents appear when access granted
  - Live Updates: Permission changes affect all connected user sessions instantly
- [ ] **Cross-workspace Isolation**: Strict separation between workspace documents
  - Data Isolation: Convex queries ensure complete workspace separation
  - Security: No possibility of cross-workspace data leakage
  - Context Persistence: Maintain workspace context across sessions
- [ ] **Shared Document Access**: Handle documents shared within workspace
  - Live Sharing: Sharing status updates immediately via Convex subscriptions
  - Permission Levels: Different access levels enforced in real-time
  - Sharing Changes: Sharing permission changes propagate instantly

#### Convex Pagination & Performance Edge Cases
- [ ] **Convex Paginated Queries**: Efficient loading of large document collections
  - Cursor-based Pagination: Use Convex cursor-based pagination for performance
  - Live Pagination: Paginated data still receives real-time updates
  - Infinite Loading: Load more documents as user scrolls through list
- [ ] **Pagination State Management**: Maintain pagination with live updates
  - Page Consistency: New documents appear in correct paginated position
  - Live Insertion: Real-time document additions don't break pagination
  - Scroll Position: Maintain user scroll position during live updates
- [ ] **Large Dataset Performance**: Handle thousands of documents efficiently
  - Server Performance: Convex handles large queries efficiently server-side
  - Client Performance: fuzzysort maintains performance even with large live datasets
  - Memory Management: Efficient memory usage with large real-time datasets
- [ ] **Pagination with Search**: Combine search with paginated Convex queries
  - Search Pagination: fuzzysort results can be paginated for large result sets
  - Live Search Pagination: Paginated search results update with live data changes
  - Performance: Maintain search performance across paginated datasets

#### Error Handling & Connection Recovery Edge Cases
- [ ] **Convex Connection Loss**: Handle temporary connection interruptions
  - Detection: Convex client detects connection loss automatically
  - Reconnection: Automatic reconnection with state recovery
  - User Feedback: Subtle "Reconnecting..." indicator during connection issues
- [ ] **Subscription Recovery**: Restore real-time subscriptions after interruption
  - State Recovery: Restore document list state after reconnection
  - Missed Updates: Fetch any updates missed during disconnection
  - Seamless Recovery: Resume real-time updates without user intervention
- [ ] **Mutation Queue During Offline**: Handle actions while disconnected
  - Queue Mutations: Store failed mutations for retry when reconnected
  - User Feedback: Indicate when actions are queued vs confirmed
  - Conflict Resolution: Handle conflicts when queued mutations execute
- [ ] **Partial Convex Functionality**: Some Convex features work, others don't
  - Graceful Degradation: Maintain basic functionality during partial outages
  - Feature Detection: Detect which Convex features are available
  - User Communication: Clear indication of reduced functionality
- [ ] **Browser Resource Constraints**: Handle memory/performance limits
  - Subscription Management: Efficiently manage multiple Convex subscriptions
  - Memory Monitoring: Monitor memory usage with large real-time datasets
  - Performance Fallback: Reduce real-time features if performance degrades