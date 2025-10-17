# Signature Field Management - Wireframes

## 01: Field Placement Interface Wireframes

### Initial Field Placement Interface - Desktop Browser

╔════════════════════════════════════════════════════════════════════════════════════════════════╗
║ ● ● ●    🌐 https://seal.nyc/document/service-agreement/fields ⚪ ⚫ 🔍 ≡           ║
╠════════════════════════════════════════════════════════════════════════════════════════════════╣
║ 🏠 Seal                                                        ░░[☰]░░ ░░[⚙]░░               ║
║ ─────────────────────────────────────────────────────────────────────────────────────────────── ║
║ ▓▓ Documents > service-agreement.pdf > Recipients > Fields ▓▓                                   ║
║ ─────────────────────────────────────────────────────────────────────────────────────────────── ║
║                                                                                                  ║
║ ▓▓ 🔧 Field Tools: ▓▓                                                                           ║
║ ▓▓[✍️ Signature]▓▓ ▓▓[🔤 Initial]▓▓ ▓▓[📅 Date]▓▓ ▓▓[📝 Text]▓▓ ▓▓[☑️ Check]▓▓                ║
║                                                                                                  ║
║ ╔════════════════════════════════════════════════════════════════════════════════════════════╗ ║
║ ║                                                                                            ║ ║
║ ║                          ▓▓ Document Preview ▓▓                                           ║ ║
║ ║                                                                                            ║ ║
║ ║         ▓▓ SERVICE AGREEMENT ▓▓                                                            ║ ║
║ ║                                                                                            ║ ║
║ ║         This agreement between ________________                                            ║ ║
║ ║         and Your Company                                                                   ║ ║
║ ║                                                                                            ║ ║
║ ║         Client Signature: ░░[____________________]░░                                       ║ ║
║ ║                                                                                            ║ ║
║ ║         Date: ░░[____________]░░                                                           ║ ║
║ ║                                                                                            ║ ║
║ ║         Service Provider: ░░[____________________]░░                                       ║ ║
║ ║                                                                                            ║ ║
║ ║                            ▓▓ Page 1 of 3 ▓▓                                             ║ ║
║ ╚════════════════════════════════════════════════════════════════════════════════════════════╝ ║
║                                                                                                  ║
║ ░░ 👥 Recipients: Client | Service Provider (configured) ░░                                    ║
║ ░░ 🔄 Pages: ◀ [1] 2 3 ▶ ░░    ░░ 📋 Field Summary: 0 fields ░░                            ║
║                                                                                                  ║
║ ░░[◀ Back to Recipients]░░ ░░[Preview Fields]░░ ▓▓[Continue →]▓▓                              ║
║                                                                                                  ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════╝

**shadcn/ui Component Mapping:**
- Breadcrumb navigation: `Breadcrumb` component with `BreadcrumbItem` and `BreadcrumbSeparator`
- Field tools toolbar: Custom toolbar with `Button` components in `variant="default"`
- Document preview: Custom PDF viewer with `border-neutral-200` (#e5e5e5)
- Form placeholders: Highlighted areas showing where fields can be placed
- Recipient status: `Badge` components with `variant="secondary"`
- Page navigation: `Pagination` component with page indicators
- Action buttons: `Button` variant="outline" for Back/Preview, variant="default" for Continue

### Field Placement in Progress - Desktop Browser

╔════════════════════════════════════════════════════════════════════════════════════════════════╗
║ ● ● ●    🌐 https://seal.nyc/document/service-agreement/fields ⚪ ⚫ 🔍 ≡           ║
╠════════════════════════════════════════════════════════════════════════════════════════════════╣
║ 🏠 Seal - Field Placement Mode                                          ░░[✕]░░               ║
║ ─────────────────────────────────────────────────────────────────────────────────────────────── ║
║                                                                                                  ║
║ ▓▓ 🔧 [✍️ Signature] [🔤 Initial] [📅 Date] [📝 Text] [☑️] ▓▓                                 ║
║                                                                                                  ║
║ ╔════════════════════════════════════════════════════════════════════════════════════════════╗ ║
║ ║                                                                                            ║ ║
║ ║         ▓▓ SERVICE AGREEMENT ▓▓                                                            ║ ║
║ ║                                                                                            ║ ║
║ ║         This agreement between ________________                                            ║ ║
║ ║         and Your Company                                                                   ║ ║
║ ║                                                                                            ║ ║
║ ║         Client Signature: ╔═══════════════════════╗                                       ║ ║
║ ║                           ║ ▓▓ ✍️ Signature Field ▓▓ ║                                       ║ ║
║ ║                           ║ Recipient: Client     ║                                       ║ ║
║ ║                           ║ Required: ✅          ║                                       ║ ║
║ ║                           ╚═══════════════════════╝                                       ║ ║
║ ║                                                                                            ║ ║
║ ║         Date: ╔════════════╗                                                              ║ ║
║ ║               ║▓▓📅 Date▓▓ ║                                                              ║ ║
║ ║               ║Client      ║                                                              ║ ║
║ ║               ╚════════════╝                                                              ║ ║
║ ║                                                                                            ║ ║
║ ║         Service Provider: ╔═══════════════════════╗                                       ║ ║
║ ║                           ║ ▓▓ ✍️ Signature Field ▓▓ ║                                       ║ ║
║ ║                           ║ Service Provider      ║                                       ║ ║
║ ║                           ║ Required: ✅          ║                                       ║ ║
║ ║                           ╚═══════════════════════╝                                       ║ ║
║ ║                            ▓▓ Page 1 of 3 ▓▓                                             ║ ║
║ ╚════════════════════════════════════════════════════════════════════════════════════════════╝ ║
║                                                                                                  ║
║ ▓▓ 📊 Field Count: 3 fields placed ▓▓                                                          ║
║ ░░ 👥 Client (2) | Service Provider (1) | Unassigned (0) ░░                                   ║
║                                                                                                  ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════╝

**shadcn/ui Component Mapping:**
- Field overlay tooltips: `Popover` or `Tooltip` components with field information
- Signature field indicators: `Card` components with `border-blue-500` (#3b82f6) for active fields
- Field count display: `Badge` components with field statistics
- Recipient assignment: Color-coded `Badge` components for different recipients
- Active field selection: `border-blue-500` (#3b82f6) with `bg-blue-50` (#eff6ff) background
- Field tooltips: `HoverCard` component for field details on hover

### Field Properties Panel - Modal Overlay

╔════════════════════════════════════════════════════════════════════════════════════════════════╗
║ ● ● ●    🌐 https://seal.nyc/document/service-agreement/fields ⚪ ⚫ 🔍 ≡           ║
╠════════════════════════════════════════════════════════════════════════════════════════════════╣
║ 🏠 Seal - Field Placement Mode                                          ░░[✕]░░               ║
║ ─────────────────────────────────────────────────────────────────────────────────────────────── ║
║ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░ ╔════════════════════════════════════════════════════════════╗ ░░░░░░░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░ ║                ▓▓ Field Properties ▓▓                     ║ ░░░░░░░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░ ╠════════════════════════════════════════════════════════════╣ ░░░░░░░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░ ║                                                            ║ ░░░░░░░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░ ║ ▓▓ ✍️ Signature Field ▓▓                                   ║ ░░░░░░░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░ ║                                                            ║ ░░░░░░░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░ ║ ╭────────────────────────────────────────────────────────╮ ║ ░░░░░░░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░ ║ │                                                        │ ║ ░░░░░░░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░ ║ │ 🏷️ Field Label:                                        │ ║ ░░░░░░░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░ ║ │ ░░[Client Signature                     ]░░             │ ║ ░░░░░░░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░ ║ │                                                        │ ║ ░░░░░░░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░ ║ │ 👤 Assign to Recipient:                                │ ║ ░░░░░░░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░ ║ │ ░░[Client                    ▼]░░                       │ ║ ░░░░░░░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░ ║ │                                                        │ ║ ░░░░░░░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░ ║ │ ⚠️ Field Requirements:                                 │ ║ ░░░░░░░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░ ║ │ ☑️ Required field                                      │ ║ ░░░░░░░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░ ║ │ ☐ Allow reject/decline                                 │ ║ ░░░░░░░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░ ║ │                                                        │ ║ ░░░░░░░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░ ║ │ 📐 Size & Position:                                    │ ║ ░░░░░░░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░ ║ │ Width: ░░[200px]░░ Height: ░░[50px]░░                   │ ║ ░░░░░░░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░ ║ │ X: ░░[150px]░░ Y: ░░[300px]░░                           │ ║ ░░░░░░░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░ ║ │                                                        │ ║ ░░░░░░░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░ ║ │ 🎨 Appearance:                                         │ ║ ░░░░░░░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░ ║ │ Border: ░░[Solid ▼]░░ Color: ░░[Blue ▼]░░              │ ║ ░░░░░░░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░ ║ │ Background: ░░[Transparent ▼]░░                         │ ║ ░░░░░░░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░ ║ │                                                        │ ║ ░░░░░░░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░ ║ │ 📝 Help Text:                                          │ ║ ░░░░░░░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░ ║ │ ╭─────────────────────────────────────────────╮       │ ║ ░░░░░░░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░ ║ │ │ Please sign here to agree to the terms     │       │ ║ ░░░░░░░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░ ║ │ ╰─────────────────────────────────────────────╯       │ ║ ░░░░░░░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░ ║ │                                                        │ ║ ░░░░░░░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░ ║ ╰────────────────────────────────────────────────────────╯ ║ ░░░░░░░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░ ║                                                            ║ ░░░░░░░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░ ║ ░░[🗑️ Delete Field]░░ ░░[📋 Duplicate]░░ ▓▓[✅ Save]▓▓     ║ ░░░░░░░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░ ║                                                            ║ ░░░░░░░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░ ╚════════════════════════════════════════════════════════════╝ ░░░░░░░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════╝

**shadcn/ui Component Mapping:**
- Modal overlay: `Dialog` with `DialogOverlay` using `bg-neutral-500/20` opacity
- Properties form: `DialogContent` with comprehensive form controls
- Field label input: `Input` component with proper labeling
- Recipient selector: `Select` component with recipient options
- Checkboxes: `Checkbox` components for field requirements
- Dimension inputs: `Input` components with number validation
- Appearance selectors: `Select` components for border styles and colors
- Help text area: `Textarea` component for multi-line input
- Action buttons: Destructive `Button` for Delete, `Button` variant="outline" for Duplicate, `Button` variant="default" for Save

---

## Multi-Page Field Management

### Page Navigation with Fields

```
┌─────────────────────────────────────────────────────────┐
│ Seal - Multi-Page Field Placement                [⚙]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 🔧 [✍️ Signature] [🔤 Initial] [📅 Date] [📝 Text] [☑️]  │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │                                                     │ │
│ │            Page 2 - Contract Terms                  │ │
│ │                                                     │ │
│ │    2.1 Payment Terms                               │ │
│ │    Client agrees to pay within 30 days             │ │
│ │                                                     │ │
│ │    Initial here to acknowledge: ┌────────────┐     │ │
│ │                                 │🔤 Initial  │     │ │
│ │                                 │Client      │     │ │
│ │                                 └────────────┘     │ │
│ │                                                     │ │
│ │    2.2 Deliverables                                │ │
│ │    Service provider will deliver...                │ │
│ │                                                     │ │
│ │    Initial here: ┌────────────┐                    │ │
│ │                  │🔤 Initial  │                    │ │
│ │                  │Client      │                    │ │
│ │                  └────────────┘                    │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ 🔄 Pages: ◀ 1 [2] 3 ▶  📊 This page: 2 fields         │
│ 📋 All Fields: Page 1 (3) | Page 2 (2) | Page 3 (1)   │
│                                                         │
│ [◀ Previous Page] [Field Overview] [Next Page ▶]       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Field Overview Across Pages

```
┌─────────────────────────────────────────────────────────┐
│ Field Overview - All Pages                        [✕]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 📋 All Fields Summary (6 total)                        │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 📄 Page 1 (3 fields)                              │ │
│ │ • ✍️ Client Signature (Required) → Client          │ │
│ │ • 📅 Signature Date (Required) → Client            │ │
│ │ • ✍️ Provider Signature (Required) → Provider      │ │
│ │ [Go to Page 1]                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 📄 Page 2 (2 fields)                              │ │
│ │ • 🔤 Payment Terms Initial (Required) → Client     │ │
│ │ • 🔤 Deliverables Initial (Required) → Client      │ │
│ │ [Go to Page 2]                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 📄 Page 3 (1 field)                               │ │
│ │ • 📝 Additional Comments (Optional) → Both         │ │
│ │ [Go to Page 3]                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ 📊 Field Statistics:                                   │
│ Required: 5 | Optional: 1 | Total Recipients: 2        │
│                                                         │
│ [◀ Back to Document] [🔍 Search Fields] [✅ Complete]  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Field Type Specific Interfaces

### Date Field Properties

```
┌─────────────────────────────────────────────────────────┐
│ Date Field Properties                             [✕]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 📅 Date Field Configuration                            │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │                                                     │ │
│ │ 🏷️ Field Label:                                     │ │
│ │ [Signature Date                         ]           │ │
│ │                                                     │ │
│ │ 👤 Assign to: [Client              ▼]              │ │
│ │                                                     │ │
│ │ ⚠️ Requirements:                                   │ │
│ │ ☑️ Required field                                  │ │
│ │ ☑️ Auto-populate with signing date                │ │
│ │ ☐ Allow manual date entry                          │ │
│ │                                                     │ │
│ │ 📅 Date Format:                                    │ │
│ │ ○ MM/DD/YYYY (03/15/2024)                          │ │
│ │ ○ DD/MM/YYYY (15/03/2024)                          │ │
│ │ ○ YYYY-MM-DD (2024-03-15)                          │ │
│ │ ● March 15, 2024 (Full format)                     │ │
│ │                                                     │ │
│ │ 📐 Validation:                                     │ │
│ │ Min Date: [None      ▼]                            │ │
│ │ Max Date: [Today     ▼]                            │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [🗑️ Delete] [📋 Duplicate] [✅ Save Properties]        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Text Field Properties

```
┌─────────────────────────────────────────────────────────┐
│ Text Field Properties                             [✕]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 📝 Text Field Configuration                            │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │                                                     │ │
│ │ 🏷️ Field Label:                                     │ │
│ │ [Company Name                           ]           │ │
│ │                                                     │ │
│ │ 👤 Assign to: [Client              ▼]              │ │
│ │                                                     │ │
│ │ ⚠️ Requirements:                                   │ │
│ │ ☑️ Required field                                  │ │
│ │                                                     │ │
│ │ 📏 Text Validation:                                │ │
│ │ Min Length: [2    ] characters                      │ │
│ │ Max Length: [100  ] characters                      │ │
│ │                                                     │ │
│ │ 🔤 Input Format:                                   │ │
│ │ ○ Any text                                         │ │
│ │ ○ Letters only                                     │ │
│ │ ○ Numbers only                                     │ │
│ │ ○ Email address                                    │ │
│ │ ○ Phone number                                     │ │
│ │                                                     │ │
│ │ 💡 Placeholder Text:                               │ │
│ │ [Enter your company name...         ]              │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [🗑️ Delete] [📋 Duplicate] [✅ Save Properties]        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Recipient Management Integration

### Field-Recipient Assignment

```
┌─────────────────────────────────────────────────────────┐
│ Field Assignment by Recipient                     [✕]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 👥 Recipient Field Assignments                         │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 👤 Client (john@company.com)                       │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │ ✍️ Signature (Page 1) - Required               │ │ │
│ │ │ 📅 Date (Page 1) - Required                    │ │ │
│ │ │ 🔤 Initial (Page 2) - Required                 │ │ │
│ │ │ 🔤 Initial (Page 2) - Required                 │ │ │
│ │ │ 📝 Company Name (Page 1) - Required            │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ │ Total: 5 fields                                    │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🏢 Service Provider (you@company.com)              │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │ ✍️ Signature (Page 1) - Required               │ │ │
│ │ │ 📝 Comments (Page 3) - Optional                │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ │ Total: 2 fields                                    │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ 📊 Summary: 7 total fields | 6 required | 1 optional  │
│                                                         │
│ [📝 Edit More Fields] [📋 Field Overview] [✅ Continue] │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Error Handling Interfaces

### Field Placement Error

```
┌─────────────────────────────────────────────────────────┐
│ Field Placement Error                            [✕]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ⚠️ Field cannot be placed here                         │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │                                                     │ │
│ │ ❌ Issue: Field extends outside document bounds     │ │
│ │                                                     │ │
│ │ 💡 Suggestions:                                    │ │
│ │ • Move field to center area of page                │ │
│ │ • Reduce field size and try again                  │ │
│ │ • Use auto-positioning guide                       │ │
│ │                                                     │ │
│ │ 📐 Current position: X:450, Y:720                  │ │
│ │ 📄 Page boundaries: Width:500, Height:700          │ │
│ │                                                     │ │
│ │ ✅ Valid placement areas highlighted on document    │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [🎯 Auto-Position] [🔧 Resize Field] [❌ Cancel]       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Field Overlap Warning

```
┌─────────────────────────────────────────────────────────┐
│ Field Overlap Warning                            [✕]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ⚠️ Field overlaps with existing field                  │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │                                                     │ │
│ │ 🔄 Overlap detected:                               │ │
│ │ New: Signature Field (Client)                       │ │
│ │ Existing: Date Field (Client)                       │ │
│ │                                                     │ │
│ │ 📐 Overlap area: 85% coverage                      │ │
│ │                                                     │ │
│ │ ✅ Your options:                                   │ │
│ │ • Move new field to avoid overlap                   │ │
│ │ • Move existing field to make room                  │ │
│ │ • Resize fields to fit side by side                │ │
│ │ • Replace existing field with new one              │ │
│ │                                                     │ │
│ │ 💡 Snap guides will help align fields properly     │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [🎯 Auto-Arrange] [🔄 Replace] [✏️ Manual] [❌ Cancel] │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Mobile Field Management

### Mobile Field Placement - iPhone Frame

┌───────────────────────────────────────┐
│  9:41 AM        ●●●     🔋 85% ●●●●   │ ← Status bar
├───────────────────────────────────────┤
│ 🏠 Seal - Add Fields      ░░[✕]░░     │ ← Header
├───────────────────────────────────────┤
│                                       │
│ ▓▓ 🔧 Field Tools ▓▓                  │ ← Toolbar
│ ▓▓[✍️]▓▓▓▓[🔤]▓▓▓▓[📅]▓▓▓▓[📝]▓▓▓▓[☑️]▓▓ │
│                                       │
│ ╔═══════════════════════════════════╗ │
│ ║                                   ║ │
│ ║    ▓▓ SERVICE AGREEMENT ▓▓        ║ │
│ ║                                   ║ │
│ ║   Client Signature:               ║ │
│ ║   ╔═══════════════════╗           ║ │
│ ║   ║ ▓▓ ✍️ Signature ▓▓ ║           ║ │
│ ║   ║ Client            ║           ║ │
│ ║   ╚═══════════════════╝           ║ │
│ ║                                   ║ │
│ ║   Date: ╔══════════════╗          ║ │
│ ║         ║▓▓📅 Date▓▓   ║          ║ │
│ ║         ╚══════════════╝          ║ │
│ ║                                   ║ │
│ ║          ▓▓ Page 1 of 3 ▓▓        ║ │
│ ╚═══════════════════════════════════╝ │
│                                       │
│ ▓▓ 📊 Fields: 2 placed ▓▓             │
│ ░░ 👥 Client(2) Provider(0) ░░        │
│                                       │
│ ░░[◀]░░ ░░[Field List]░░ ░░[Next▶]░░   │
│                                       │
└───────────────────────────────────────┘
│                                       │ ← Home indicator area
└───────────────────────────────────────┘

**shadcn/ui Component Mapping:**
- Mobile toolbar: Custom horizontal scrolling toolbar with field type buttons
- Document container: Mobile-optimized PDF viewer with touch interactions
- Field indicators: Smaller `Card` components for mobile field overlays
- Progress display: `Badge` components showing field counts
- Navigation: Mobile-friendly `Button` components with touch targets
- Field types: Icon-only buttons with appropriate touch spacing

### Mobile Field Properties - iPhone Frame

┌───────────────────────────────────────┐
│  9:41 AM        ●●●     🔋 85% ●●●●   │ ← Status bar
├───────────────────────────────────────┤
│ ▓▓ Field Properties ▓▓     ░░[✕]░░    │ ← Header
├───────────────────────────────────────┤
│                                       │
│ ▓▓ ✍️ Signature Field ▓▓              │
│                                       │
│ Label:                                │
│ ░░[Client Signature         ]░░       │
│                                       │
│ Recipient:                            │
│ ░░[Client                    ▼]░░     │
│                                       │
│ ☑️ Required field                     │
│ ☐ Allow decline                       │
│                                       │
│ ▓▓ 📐 Size: ▓▓                        │
│ W:░░[200]░░ H:░░[50]░░                 │
│                                       │
│ ▓▓ 📝 Help Text: ▓▓                   │
│ ╔═══════════════════════════════════╗ │
│ ║ Sign here to agree to terms       ║ │
│ ╚═══════════════════════════════════╝ │
│                                       │
│ ░░[🗑️ Delete]░░     ▓▓[✅ Save]▓▓      │
│                                       │
└───────────────────────────────────────┘
│                                       │ ← Home indicator area
└───────────────────────────────────────┘

**shadcn/ui Component Mapping:**
- Mobile modal: Full-screen modal optimized for touch interaction
- Form inputs: Mobile-sized `Input` components with proper touch targets
- Checkboxes: Touch-friendly `Checkbox` components
- Action buttons: Full-width mobile `Button` components
- Textarea: Mobile-optimized `Textarea` for help text input

---

## Field Management Completion

### Field Placement Complete

```
┌─────────────────────────────────────────────────────────┐
│ Signature Fields Complete                         [✕]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ✅ All signature fields configured!                     │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │                                                     │ │
│ │ 📊 Field Summary:                                  │ │
│ │ • Total fields: 7                                  │ │
│ │ • Required fields: 6                               │ │
│ │ • Optional fields: 1                               │ │
│ │ • Recipients: 2                                    │ │
│ │                                                     │ │
│ │ 👥 Recipient Breakdown:                            │ │
│ │ • Client: 5 fields (all required)                  │ │
│ │ • Service Provider: 2 fields (1 required)          │ │
│ │                                                     │ │
│ │ 📄 Page Distribution:                              │ │
│ │ • Page 1: 3 signature fields                       │ │
│ │ • Page 2: 3 initial fields                         │ │
│ │ • Page 3: 1 comment field                          │ │
│ │                                                     │ │
│ │ ✅ All fields properly assigned to recipients      │ │
│ │ ✅ All required fields marked appropriately        │ │
│ │ ✅ Field validation configured correctly            │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ 🎯 Next Steps:                                          │
│ • Review final field assignments                       │ │
│ • Add custom messages for recipients                   │ │
│ • Send document for signatures                         │ │
│                                                         │
│ [◀ Edit More Fields] [📤 Send Document →]              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

This completes the comprehensive wireframes for signature field management, covering all aspects of field placement, editing, and management while maintaining focus on intuitive user experience and seamless workflow integration.