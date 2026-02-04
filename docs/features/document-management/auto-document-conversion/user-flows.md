                       ▍▍▍ SEAL LOGO ▍▍▍
     ╔══════════════════════════════════════════════════════════════════════════════════════════╗
     ║                          🔄 AUTO DOCUMENT CONVERSION USER FLOWS                         ║
     ╚══════════════════════════════════════════════════════════════════════════════════════════╝

## Primary Conversion Flows

### Single Document Conversion Flow

[User Journey: Complete conversion lifecycle from upload to signature-ready PDF]
[Process Flow: Multi-stage conversion with real-time progress tracking]

```
◉ User Uploads Office Document (Word/Excel/PowerPoint/Image)
    ┃
    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃                                                                 ┃
■━┨ Automatic Conversion Trigger                                    ┃
    ┃ ┇━ Document validated for supported format                     ┃
    ┃ ┇━ File queued for conversion via Chromiumly                  ┃
    ┃ ┇━ User sees "Converting to PDF..." status                     ┃
    ┃ ┗━ Estimated conversion time displayed                         ┃
    ┃                                                                 ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
    ┃
◉ Conversion Processing (Chromiumly + Fly.io)
    ┃
    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃ ┇━ Document sent securely to Gotenberg on Fly.io              ┃
    ┃ ┇━ LibreOffice engine converts to PDF                        ┃
    ┃ ┇━ Real-time progress updates via Convex                     ┃
    ┃ ┗━ Converted PDF returned to React app                       ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
    ┃
■ Conversion Completion
    ┃
    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃ ┇━ Success: "Document converted successfully!"                ┃
    ┃ ┇━ Original file preserved (optional setting)                ┃
    ┃ ┇━ PDF available for preview and editing                     ┃
    ┃ ┗━ Ready for signature field placement                        ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
    ┃
◉ Post-Conversion Actions
    ┃
    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃ ┇━ Automatic PDF preview generation                           ┃
    ┃ ┇━ Document appears in document list as PDF                  ┃
    ┃ ┇━ Metadata extracted (pages, size, title)                   ┃
    ┃ ┗━ Quota count updated (Free: 8/10 → 9/10)                  ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

### Batch Document Conversion Flow

[User Journey: Multi-file conversion with intelligent queue management]
[Process Flow: Parallel processing with individual progress tracking]

```
◉ User Uploads Multiple Mixed-Format Files
    ┃
    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃                                                                 ┃
■━┨ Batch Conversion Queue Management                               ┃
    ┃ ┇━ PDFs bypass conversion (instant processing)                ┃
    ┃ ┇━ Office/Image files queued for conversion                   ┃
    ┃ ┇━ Conversion priority: smaller files first                   ┃
    ┃ ┗━ Up to 3 concurrent conversions (resource management)       ┃
    ┃                                                                 ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
    ┃
◉ Parallel Conversion Processing
    ┃
    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃ ┇━ Each file shows individual progress                        ┃
    ┃ ┇━ Overall batch progress displayed                           ┃
    ┃ ┇━ Failed conversions don't block others                     ┃
    ┃ ┗━ User can cancel individual conversions                     ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
    ┃
■ Batch Completion Summary
    ┃
    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃ ┇━ "4 of 5 documents converted successfully"                  ┃
    ┃ ┇━ Failed files listed with retry option                     ┃
    ┃ ┇━ All successful PDFs ready for use                         ┃
    ┃ ┗━ Quota updated for successful conversions only             ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

---

## Conversion Progress & Status Flows

### Real-Time Progress Updates

[User Experience: Live progress tracking with interactive elements]
[System Integration: Background processing with notification system]

```
◉ Document in Conversion Process
    ┃
    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃                                                                 ┃
■━┨ Progress Indicator States                                       ┃
    ┃ ┇━ "Queued for conversion..." (waiting in line)               ┃
    ┃ ┇━ "Converting to PDF... 45%" (active conversion)             ┃
    ┃ ┇━ "Finalizing document..." (post-processing)                 ┃
    ┃ ┗━ "Conversion complete!" (success)                           ┃
    ┃                                                                 ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
    ┃
◉ Interactive Progress Experience
    ┃
    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃ ┇━ Visual progress bar with percentage                        ┃
    ┃ ┇━ Estimated time remaining                                   ┃
    ┃ ┇━ Cancel conversion option (before 80% complete)            ┃
    ┃ ┗━ User can navigate away and return                          ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
    ┃
■ Background Conversion Handling
    ┃
    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃ ┇━ Conversion continues if user navigates away               ┃
    ┃ ┇━ Notification when conversion completes                    ┃
    ┃ ┇━ Document appears in list when ready                       ┃
    ┃ ┗━ Activity feed shows conversion completion                  ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

### Conversion Quality Verification

[Quality Assurance: Automated validation with manual review options]
[User Choice: Accept conversion or retry with different settings]

```
◉ PDF Conversion Completed
    ┃
    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃                                                                 ┃
■━┨ Automatic Quality Checks                                        ┃
    ┃ ┇━ PDF structure validation                                   ┃
    ┃ ┇━ Page count verification                                    ┃
    ┃ ┇━ Content integrity check                                    ┃
    ┃ ┗━ File size optimization                                     ┃
    ┃                                                                 ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
    ┃
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ [If Quality Issues Detected]                                     ┃
┃    ┃                                                              ┃
┃    ◉ Quality Warning Display                                      ┃
┃        ┇━ "Conversion completed with formatting changes"        ┃
┃        ┇━ Preview both original and converted versions           ┃
┃        ┇━ Option to retry conversion with different settings     ┃
┃        ┗━ Option to proceed anyway                               ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
    ┃
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ [If Quality Acceptable]                                          ┃
┃    ┃                                                              ┃
┃    ◉ Standard Completion Flow                                     ┃
┃        ┗━ Document ready for signature workflow                  ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

---

## Error Handling & Recovery Flows

### Conversion Failure Recovery

[Error Handling: Graceful degradation with multiple recovery paths]
[User Empowerment: Clear options for resolving conversion issues]

```
◉ Document Conversion Fails
    ┃
    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃                                                                 ┃
■━┨ Error Classification & Response                                 ┃
    ┃ ┇━ File Format Error → "Document format not fully supported"  ┃
    ┃ ┇━ Corruption Error → "File appears corrupted"                ┃
    ┃ ┇━ Service Error → "Conversion service temporarily unavailable" ┃
    ┃ ┗━ Timeout Error → "Document too complex to convert"          ┃
    ┃                                                                 ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
    ┃
◉ User Recovery Options
    ┃
    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃ ┇━ "Retry Conversion" → Queue again with same settings         ┃
    ┃ ┇━ "Try Different Format" → Upload new version                 ┃
    ┃ ┇━ "Convert Manually" → Instructions for manual PDF export     ┃
    ┃ ┗━ "Skip Conversion" → Upload original with limited features   ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
    ┃
■ Fallback Handling
    ┃
    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃ ┇━ Store original file in document list                       ┃
    ┃ ┇━ Mark with "Conversion Failed" status                       ┃
    ┃ ┇━ Limited preview capabilities                               ┃
    ┃ ┗━ Option to retry conversion later                           ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

### Service Outage Management

```
○ Fly.io/Gotenberg Service Unavailable
    ↓
□ Graceful Degradation
    ├─ "Conversion service temporarily unavailable"
    ├─ Documents queued for conversion when service returns
    ├─ PDF uploads continue normally
    └─ Clear status updates about service restoration
    ↓
○ User Communication
    ├─ Real-time service status updates
    ├─ Estimated service restoration time
    ├─ Alternative workflow suggestions (upload PDF directly)
    └─ Email notification when service restored
```

### Network Interruption During Conversion

```
○ Network Connection Lost During Conversion
    ↓
□ Connection Recovery Handling
    ├─ Conversion continues on server (Fly.io)
    ├─ Status updates resume when connection restored
    ├─ No need to restart conversion process
    └─ User notified of connection issue and recovery
    ↓
○ Extended Disconnection
    ├─ Conversion completes on server
    ├─ Document appears when user reconnects
    ├─ Notification of completed conversion
    └─ No quota impact from network issues
```

---

## Freemium Model Integration Flows

### Free Plan Conversion Quota Management

```
○ Free Plan User Initiates Conversion (9/10 documents used)
    ↓
□ Pre-Conversion Quota Check
    ├─ "1 document remaining this month"
    ├─ Conversion proceeds normally
    ├─ Quota reminder during conversion
    └─ Upgrade suggestion after completion
    ↓
○ Conversion Success
    ├─ Document successfully converted
    ├─ Quota updated to 10/10
    ├─ "Document limit reached" notification
    └─ Clear upgrade path presented
```

### Free Plan Limit Reached During Conversion

```
○ Free Plan User at 10/10 Limit Tries Conversion
    ↓
□ Conversion Blocked Before Processing
    ├─ "Document upload limit reached (10/10)"
    ├─ "Upgrade to Pro for unlimited conversions"
    ├─ Conversion not attempted (no quota consumption)
    └─ Clear upgrade options presented
    ↓
○ Upgrade Path Options
    ├─ "Start 2-week Pro trial" → Immediate conversion access
    ├─ "View Pro features" → Feature comparison
    ├─ "Limit resets [date]" → Wait option
    └─ Return to document dashboard
```

### Pro Plan Conversion Benefits

```
○ Pro Plan User Conversion Experience
    ↓
□ Priority Conversion Processing
    ├─ Higher priority in conversion queue
    ├─ Faster processing for large documents
    ├─ Support for larger batch conversions
    └─ No conversion limits or warnings
    ↓
○ Enhanced Pro Features
    ├─ Advanced conversion settings
    ├─ Conversion history and analytics
    ├─ Premium support for conversion issues
    └─ API access for automated conversions (future)
```

---

## Advanced Conversion Scenarios

### Large Document Conversion (20MB+)

```
○ User Uploads Large Office Document
    ↓
□ Extended Conversion Process
    ├─ "Large document detected - extended processing time"
    ├─ Progress updates every 10 seconds
    ├─ Timeout extension to 60 seconds
    └─ User can continue other work
    ↓
○ Resource Management
    ├─ Single large conversion at a time
    ├─ Other conversions queued behind large files
    ├─ Clear communication about wait times
    └─ Option to cancel if taking too long
```

### Complex Document Conversion (Charts, Embedded Objects)

```
○ Excel with Charts/PowerPoint with Animations
    ↓
□ Advanced Conversion Handling
    ├─ "Converting complex document - preserving formatting"
    ├─ Extended processing for chart rendering
    ├─ Animation frames converted to static slides
    └─ Quality verification after conversion
    ↓
○ Conversion Result Review
    ├─ Side-by-side preview of original vs. converted
    ├─ Highlight any formatting changes
    ├─ Option to retry with different settings
    └─ Accept conversion or try manual export
```

### Template Document Conversion

```
○ User Uploads Template with Form Fields
    ↓
□ Template-Aware Conversion
    ├─ Preserve form fields during conversion
    ├─ Maintain fillable areas
    ├─ Convert to PDF form format
    └─ Template functionality retained
    ↓
○ Template Integration
    ├─ Converted template available for reuse
    ├─ Form fields ready for signature workflow
    ├─ Template library organization
    └─ Version control for template updates
```

---

## Integration Touch Points

### Document Upload Pipeline Integration

```
○ Seamless Upload → Conversion Flow
    ↓
□ Unified Progress Experience
    ├─ Upload progress (0-50%)
    ├─ Conversion progress (50-100%)
    ├─ Single progress bar for entire process
    └─ No separate conversion step for user
    ↓
○ Error Handling Integration
    ├─ Upload errors handled before conversion
    ├─ Conversion errors don't affect upload quota
    ├─ Clear distinction between upload and conversion issues
    └─ Retry options appropriate to error type
```

### Signature Workflow Integration

```
○ Conversion Complete → Signature Ready
    ↓
□ Automatic Workflow Transition
    ├─ PDF immediately available for signature fields
    ├─ Document preview loads without delay
    ├─ Conversion history preserved
    └─ Original format metadata maintained
    ↓
○ Document Management Integration
    ├─ Converted documents properly categorized
    ├─ Search includes original format keywords
    ├─ Sharing settings preserved through conversion
    └─ Activity log shows conversion completion
```

This comprehensive user flow documentation covers the entire auto document conversion experience while maintaining focus on user experience, freemium model integration, and seamless workflow transitions.
