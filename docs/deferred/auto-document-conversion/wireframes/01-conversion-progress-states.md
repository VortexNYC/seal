                       ▓▓▓ SEAL LOGO ▓▓▓
     ╔══════════════════════════════════════════════════════════════════════════════════════════════╗
     ║                        🔄 AUTO DOCUMENT CONVERSION WIREFRAMES                                ║
     ╚══════════════════════════════════════════════════════════════════════════════════════════════╝

## Conversion Progress States

### Single Document Conversion Progress

[Mobile Viewport: 375px with vertical progress layout]
[Desktop Viewport: 1200px with horizontal progress monitoring]

```
╔════════════════════════════════════════════════════════════════════════════════════════════════╗
║ ● ● ●    🌐 https://seal.nyc/documents/conversion             ⚪ ⚫ 🔍 ≡           ║
║ 🏠 Seal                                    👤 John Doe    [Badge: variant="default"] 🔄 Pro Plan ║
╠════════════════════════════════════════════════════════════════════════════════════════════════╣
║                                                                                                  ║
║  📄 Documents                                         [Button: variant="default" + Upload Document] ║
║                                                                                                  ║
║  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓    ║
║  ┃                    [Card: className="border-2"] 🔄 Converting Document                        ┃    ║
║  ┃                                                                                               ┃    ║
║  ┃     📊 Quarterly-Report.xlsx → PDF                                                            ┃    ║
║  ┃                                                                                               ┃    ║
║  ┃     [Badge: variant="secondary" icon="🔄"] Converting to PDF...                              ┃    ║
║  ┃     [Progress: value={65} max={100} className="w-full"] ████████████████████████████████████████████████ ┃    ║
║  ┃     65% complete - About 15 seconds remaining                                                 ┃    ║
║  ┃                                                                                               ┃    ║
║  ┃     [Alert: variant="default" icon="💡"] Your document is being converted to PDF for signing  ┃    ║
║  ┃                                                                                               ┃    ║
║  ┃                           [Button: variant="destructive"] Cancel                            ┃    ║
║  ┃                                                                                               ┃    ║
║  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛    ║
║                                                                                                  ║
║  📋 Recent Documents                                                                             ║
║  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓    ║
║  ┃ 📄 Contract.pdf          │ 3 pages │ 2 days ago     │ [Button: size="sm"] Preview [Button: size="sm"] 📝 ┃    ║
║  ┃ 📄 Agreement.pdf         │ 5 pages │ 1 week ago     │ [Button: size="sm"] Preview [Button: size="sm"] 📝 ┃    ║
║  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛    ║
║                                                                                                  ║
╚════════════════════════════════════════════════════════════════════════════════════════════════╝
```

### Conversion Queue Status

[Component: Multi-document queue with individual progress tracking]
[Mobile Viewport: Stacked queue items with collapsible details]

```
╔════════════════════════════════════════════════════════════════════════════════════════════════╗
║                       [Card: className="border-2"] 🔄 Converting Documents                      ║
╠════════════════════════════════════════════════════════════════════════════════════════════════╣
║                                                                                                  ║
║  📊 Sales-Report.xlsx        [Badge: variant="default" icon="✅"] Converted successfully         ║
║  📝 Meeting-Notes.docx       [Badge: variant="secondary" icon="🔄"] Converting... (45%)          ║
║  🎨 Presentation.pptx        [Badge: variant="outline" icon="⏳"] In queue (position 1)          ║
║  📄 Invoice.pdf              [Badge: variant="default" icon="✅"] No conversion needed            ║
║                                                                                                  ║
║  [Progress: value={50} max={100} className="w-full"] Overall Progress: 2 of 4 documents ready   ║
║                                                                                                  ║
║                                    [Button: variant="destructive"] Cancel All                   ║
║                                                                                                  ║
╚════════════════════════════════════════════════════════════════════════════════════════════════╝
```

### Conversion Success State

[Component: Success celebration with clear next actions]
[Mobile Viewport: Vertical button stack with primary CTA prominent]

```
╔════════════════════════════════════════════════════════════════════════════════════════════════╗
║                         [Alert: variant="default" icon="✅"] Conversion Complete!               ║
╠════════════════════════════════════════════════════════════════════════════════════════════════╣
║                                                                                                  ║
║     📊 Quarterly-Report.xlsx successfully converted to PDF                                       ║
║                                                                                                  ║
║     📋 What would you like to do next?                                                          ║
║                                                                                                  ║
║     [Button: variant="default" icon="📝"] Add Signature Fields     [Button: variant="outline" icon="👁️"] Preview Document ║
║                                                                                                  ║
║     [Button: variant="secondary" icon="👥"] Share with Team          [Button: variant="ghost" icon="🏠"] Back to Documents ║
║                                                                                                  ║
╚════════════════════════════════════════════════════════════════════════════════════════════════╝
```

---

## Conversion Error States

### Conversion Failure Dialog

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ❌ Conversion Failed                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Conversion failed for Quarterly-Report.xlsx                               │
│                                                                             │
│  Issue: Document format not fully supported                                │
│                                                                             │
│  Here's what to try:                                                       │
│  • Save your document as a newer format (.xlsx, .docx, .pptx)             │
│  • Export manually to PDF from your Office application                     │
│  • Try uploading a different version of the document                       │
│                                                                             │
│                    [Retry Conversion]      [Try Different File]            │
│                                                                             │
│                              [Contact Support]                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Service Unavailable State

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      ⚠️ Conversion Service Unavailable                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Our document conversion service is temporarily unavailable.               │
│                                                                             │
│  📄 PDF files can still be uploaded and processed normally                 │
│  📊 Office documents will be queued for conversion when service returns    │
│                                                                             │
│  💡 Alternative: Export your document to PDF manually and upload           │
│                                                                             │
│  Estimated restoration: Within 15 minutes                                  │
│                                                                             │
│                              [Upload PDF Instead]                          │
│                                                                             │
│                              [Queue for Later]                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Complex Document Warning

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ⚠️ Complex Document Detected                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  📊 Quarterly-Report.xlsx contains charts and complex formatting           │
│                                                                             │
│  💡 This may take longer to convert and some formatting might change       │
│                                                                             │
│  We recommend:                                                              │
│  • Review the converted PDF before adding signature fields                 │
│  • Consider exporting to PDF manually for best results                     │
│                                                                             │
│                                                                             │
│                    [Continue Conversion]    [Export to PDF First]          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Freemium Model Integration

### Free Plan Conversion with Quota

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🏠 Seal                                    👤 Jane Smith   🆓 Free Plan      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  📄 Documents                                 📊 9/10 documents used        │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    🔄 Converting Document                           │    │
│  │                                                                     │    │
│  │     📝 Report.docx → PDF                                            │    │
│  │                                                                     │    │
│  │     Converting to PDF...                                           │    │
│  │     ████████████████████████████████████████████████               │    │
│  │     80% complete - About 8 seconds remaining                       │    │
│  │                                                                     │    │
│  │     💡 This will be your last document this month                   │    │
│  │        Upgrade to Pro for unlimited conversions                    │    │
│  │                                                                     │    │
│  │                           [Cancel]                                  │    │
│  │                                                                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Free Plan Limit Reached

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        🚫 Conversion Limit Reached                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│              You've reached your 10 document limit for this month          │
│                         (limit resets February 15)                         │
│                                                                             │
│              📊 Office documents require conversion to PDF                  │
│              📄 You can still upload PDF files directly                    │
│                                                                             │
│              [🚀 Start Pro Trial - 2 weeks free]                           │
│                                                                             │
│              ✅ Unlimited document conversions                              │
│              ✅ Priority conversion processing                              │
│              ✅ Batch conversion support                                    │
│                                                                             │
│                        [View Pro Features]                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Advanced Conversion Scenarios

### Large Document Conversion

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       🔄 Converting Large Document                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│     📊 Annual-Report.xlsx (25MB) → PDF                                     │
│                                                                             │
│     Converting large document to PDF...                                    │
│     ████████████████████████████████████████████                          │                             │
│     35% complete - About 45 seconds remaining                              │
│                                                                             │
│     💡 Large documents take more time to convert                           │
│        You can continue working while this processes                       │
│                                                                             │
│                    [Minimize]              [Cancel]                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Batch Conversion Progress

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      🔄 Batch Document Conversion                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Converting 5 documents to PDF...                                          │
│                                                                             │
│  📄 Contract.pdf              ✅ No conversion needed                       │
│  📝 Terms.docx                ✅ Converted successfully                     │
│  📊 Budget.xlsx               🔄 Converting... (60%)                       │
│  🎨 Slides.pptx               ⏳ In queue                                   │
│  🖼️ Diagram.png               ⏳ In queue                                   │
│                                                                             │
│  Overall Progress: 2 of 5 complete                                         │
│  ████████████████████                                                      │
│                                                                             │
│                              [Cancel Remaining]                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Conversion Quality Review

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        📋 Conversion Review                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  📊 Quarterly-Report.xlsx converted with formatting changes                │
│                                                                             │
│  ┌─────────────────────┐    ┌─────────────────────┐                        │
│  │   Original Excel    │    │   Converted PDF     │                        │
│  │                     │    │                     │                        │
│  │   [Chart preview    │    │   [Chart rendered   │                        │
│  │    with colors      │    │    in PDF format    │                        │
│  │    and animations]  │    │    static version]  │                        │
│  │                     │    │                     │                        │
│  └─────────────────────┘    └─────────────────────┘                        │
│                                                                             │
│  ⚠️ Some chart animations converted to static images                       │
│                                                                             │
│                [Retry Conversion]         [Accept & Continue]               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Mobile Conversion Experience

### Mobile Conversion Progress

```
┌─────────────────────────────┐
│         🔄 Converting       │
├─────────────────────────────┤
│                             │
│ 📝 Report.docx → PDF        │
│                             │
│ Converting to PDF...        │
│                             │
│ ████████████████████        │
│                             │
│ 70% complete                │
│ ~12 seconds left            │
│                             │
│ 💡 This will use 1 of your  │
│    remaining 2 documents    │
│                             │
│        [Cancel]             │
│                             │
└─────────────────────────────┘
```

### Mobile Conversion Complete

```
┌─────────────────────────────┐
│    ✅ Conversion Complete   │
├─────────────────────────────┤
│                             │
│ Report.docx → PDF           │
│                             │
│ Successfully converted!     │
│                             │
│ What next?                  │
│                             │
│ [📝 Add Signature Fields]   │
│                             │
│ [👁️ Preview Document]       │
│                             │
│ [🏠 Back to Documents]      │
│                             │
└─────────────────────────────┘
```

---

## Integration States

### Conversion Within Upload Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           📤 Processing Document                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│     📊 Quarterly-Report.xlsx                                                │
│                                                                             │
│     ✅ Upload complete (100%)                                               │
│     🔄 Converting to PDF... (65%)                                          │
│                                                                             │
│     ████████████████████████████████████████████████                      │
│     Overall Progress: 82% complete                                         │
│                                                                             │
│     💡 Almost ready! Converting your Excel file to PDF for signing         │
│                                                                             │
│                                 [Cancel]                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Ready for Signature Workflow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ✅ Document Ready!                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│     📊 Quarterly-Report.xlsx → Quarterly-Report.pdf                        │
│                                                                             │
│     Your document has been uploaded and converted to PDF                   │
│                                                                             │
│     🎯 Ready for signature fields                                          │
│                                                                             │
│     [📝 Add Signature Fields] ← Recommended next step                      │
│                                                                             │
│     [👁️ Preview Document]        [👥 Share with Team]                     │
│                                                                             │
│     [📁 Organize Document]       [🏠 Back to Documents]                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

These wireframes cover all the key conversion scenarios while maintaining the clean, focused design that avoids unnecessary clutter for Pro users while providing helpful information for Free plan users approaching their limits.
