# Document Preview & Management Wireframes

## Document Preview Interface

### Document List with Previews - Desktop Browser

╔════════════════════════════════════════════════════════════════════════════════════════════════╗
║ ● ● ●    🌐 https://seal.nyc/documents                        ⚪ ⚫ 🔍 ≡           ║
╠════════════════════════════════════════════════════════════════════════════════════════════════╣
║ 🏠 Seal                                    👤 John Doe    🔄 Pro Plan                            ║
║ ─────────────────────────────────────────────────────────────────────────────────────────────── ║
║                                                                                                  ║
║ ▓▓ 📄 Documents ▓▓                                        ░░ [+ Upload Document] ░░           ║
║                                                                                                  ║
║ ░░ 🔍 [Search documents...] ░░                             ░░ 📊 Sort: Recent ▼ ░░            ║
║                                                                                                  ║
║ ╔════════════════════════════════════════════════════════════════════════════════════════════╗ ║
║ ║                                                                                            ║ ║
║ ║ ╭─────────╮  ▓▓ 📄 Contract.pdf ▓▓                               ░░[📝]░░ ░░[⚙️]░░       ║ ║
║ ║ │ ░░ 📄 ░░ │  3 pages • 1.2 MB • 2 days ago                                             ║ ║
║ ║ │ ░ PAGE ░ │  Created by John Doe                                                        ║ ║
║ ║ │ ░ 1/3  ░ │  ░░ 📁 Legal Documents ░░                                                  ║ ║
║ ║ ╰─────────╯                                                                             ║ ║
║ ║                                                                                            ║ ║
║ ║ ╭─────────╮  ▓▓ 📊 Quarterly-Report.xlsx → PDF ▓▓       ░░[📝]░░ ░░[⚙️]░░             ║ ║
║ ║ │ ░░ 📊 ░░ │  1 page • 0.8 MB • 1 week ago                                              ║ ║
║ ║ │ ░CHART░ │  Created by John Doe • Converted from Excel                                ║ ║
║ ║ │ ░     ░ │  ░░ 📁 Reports ░░                                                         ║ ║
║ ║ ╰─────────╯                                                                             ║ ║
║ ║                                                                                            ║ ║
║ ║ ╭─────────╮  ▓▓ 📄 NDA-Agreement.pdf ▓▓                 ░░[📝]░░ ░░[⚙️]░░             ║ ║
║ ║ │ ░░ 📄 ░░ │  5 pages • 2.3 MB • 2 weeks ago                                            ║ ║
║ ║ │ ░ PAGE ░ │  Created by John Doe                                                        ║ ║
║ ║ │ ░ 1/5  ░ │  ░░ 📁 Legal Documents ░░ • ░░ 🏷️ contracts ░░                           ║ ║
║ ║ ╰─────────╯                                                                             ║ ║
║ ║                                                                                            ║ ║
║ ╚════════════════════════════════════════════════════════════════════════════════════════════╝ ║
║                                                                                                  ║
║                                  ░░ [Load More Documents] ░░                                   ║
║                                                                                                  ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════╝

**shadcn/ui Component Mapping:**
- Background: `bg-neutral-50` (#fafafa)
- Main content area: `bg-white` (#ffffff)
- Section headers: `bg-neutral-900` (#171717) with `text-white`
- Search input: `Input` component with `bg-neutral-100` (#f5f5f5)
- Action buttons: `Button` variant="secondary" `bg-neutral-100` (#f5f5f5)
- Document cards: `Card` component with `border-neutral-200` (#e5e5e5)
- File type icons: `bg-neutral-100` (#f5f5f5) containers
- Tags: `Badge` variant="secondary" with `bg-neutral-100` (#f5f5f5)
- Load more: `Button` variant="ghost" with `text-neutral-600` (#525252)

### Full Document Preview - Desktop Browser

╔════════════════════════════════════════════════════════════════════════════════════════════════╗
║ ● ● ●    🌐 https://seal.nyc/document/contract-pdf            ⚪ ⚫ 🔍 ≡           ║
╠════════════════════════════════════════════════════════════════════════════════════════════════╣
║ ░░ ← Back to Documents ░░                 ▓▓ Contract.pdf ▓▓              ░░ [⚙️] ░░          ║
║ ─────────────────────────────────────────────────────────────────────────────────────────────── ║
║                                                                                                  ║
║ ╭─────────────────────────────╮  ▓▓ 📄 Contract.pdf ▓▓                                        ║
║ │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░ │  3 pages • 1.2 MB • 2 days ago                                 ║
║ │ ░░     PDF PAGE         ░░ │  ░░ 📁 Legal Documents ░░                                      ║
║ │ ░░    CONTENT           ░░ │                                                                 ║
║ │ ░░     PAGE 1           ░░ │  ░░ 🎯 Ready for signature fields ░░                           ║
║ │ ░░                     ░░ │                                                                 ║
║ │ ░░ [Preview content    ░░ │  ▓▓ [📝 Add Signature Fields] ▓▓                              ║
║ │ ░░  rendered here]     ░░ │                                                                 ║
║ │ ░░                     ░░ │  ░░ 👥 Share with team ░░                                      ║
║ │ ░░                     ░░ │  ░░ 🔗 Create sharing link ░░                                  ║
║ │ ░░                     ░░ │  ░░ 📧 Send for signature ░░                                   ║
║ │ ░░                     ░░ │                                                                 ║
║ │ ░░                     ░░ │  ▓▓ 📋 Document Details ▓▓                                     ║
║ │ ░░                     ░░ │  Created: Jan 5, 2024                                           ║
║ │ ░░                     ░░ │  Modified: Jan 7, 2024                                          ║
║ │ ░░                     ░░ │  Size: 1.2 MB                                                   ║
║ │ ░░                     ░░ │  Format: PDF                                                    ║
║ ╰─────────────────────────────╯                                                               ║
║                                                                                                  ║
║ ░░ ◀️ Previous ░░     ▓▓ Page 1 of 3 ▓▓     ░░ Next ▶️ ░░            ░░ 🔍 Zoom: 100% ▼ ░░   ║
║                                                                                                  ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════╝

**shadcn/ui Component Mapping:**
- Navigation breadcrumb: `Breadcrumb` component with `text-neutral-600` (#525252)
- Document title: `Typography` h2 with `text-neutral-900` (#171717)
- PDF preview container: Custom viewer with `border-neutral-200` (#e5e5e5)
- Action buttons: `Button` variant="default" for primary, variant="outline" for secondary
- Document details section: `Card` component with `bg-neutral-50` (#fafafa)
- Page navigation: `Pagination` component with controls
- Zoom control: `Select` component for zoom levels

### Document Preview with Navigation - Desktop Browser

╔════════════════════════════════════════════════════════════════════════════════════════════════╗
║ ● ● ●    🌐 https://seal.nyc/document/nda-agreement-pdf       ⚪ ⚫ 🔍 ≡           ║
╠════════════════════════════════════════════════════════════════════════════════════════════════╣
║ ░░ ← Back ░░                          ▓▓ NDA-Agreement.pdf ▓▓              ░░ [⚙️] ░░          ║
║ ─────────────────────────────────────────────────────────────────────────────────────────────── ║
║                                                                                                  ║
║ ╭─────────────────────────────╮  ▓▓ 📄 NDA-Agreement.pdf ▓▓                                   ║
║ │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░ │  5 pages • 2.3 MB                                               ║
║ │ ░░     PDF PAGE         ░░ │                                                                 ║
║ │ ░░    CONTENT           ░░ │  ▓▓ Page Thumbnails: ▓▓                                        ║
║ │ ░░     PAGE 3           ░░ │  ╭───╮ ╭───╮ ╭───╮ ╭───╮ ╭───╮                               ║
║ │ ░░                     ░░ │  │ 1 │ │ 2 │ │▓3▓│ │ 4 │ │ 5 │                               ║
║ │ ░░ [Preview content    ░░ │  ╰───╯ ╰───╯ ╰───╯ ╰───╯ ╰───╯                               ║
║ │ ░░  rendered here      ░░ │                                                                 ║
║ │ ░░   for page 3]       ░░ │  ▓▓ [📝 Add Signature Fields] ▓▓                              ║
║ │ ░░                     ░░ │                                                                 ║
║ │ ░░                     ░░ │  ▓▓ Actions: ▓▓                                                ║
║ │ ░░                     ░░ │  ░░ 📄 Download PDF ░░                                         ║
║ │ ░░                     ░░ │  ░░ 🗑️ Delete Document ░░                                      ║
║ │ ░░                     ░░ │  ░░ ✏️ Rename Document ░░                                      ║
║ │ ░░                     ░░ │  ░░ 📁 Move to Folder ░░                                       ║
║ ╰─────────────────────────────╯                                                               ║
║                                                                                                  ║
║ ░░ ◀️ Previous ░░     ▓▓ Page 3 of 5 ▓▓     ░░ Next ▶️ ░░            ░░ 🔍 Zoom: 125% ▼ ░░   ║
║                                                                                                  ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════╝

**shadcn/ui Component Mapping:**
- Page thumbnails: Custom grid with `border-neutral-300` (#d4d4d8), active state `border-neutral-600` (#525252)
- Current page indicator: `Badge` variant="default" with `bg-neutral-900` (#171717)
- Document actions list: `DropdownMenu` with `MenuItem` components
- Action items: `Button` variant="ghost" with appropriate icons
- Destructive action (Delete): `Button` variant="destructive" with `text-red-600` (#dc2626)

---

## Document Management Actions

### Document Settings Menu - Desktop Browser

╔════════════════════════════════════════════════════════════════════════════════════════════════╗
║ ● ● ●    🌐 https://seal.nyc/documents                        ⚪ ⚫ 🔍 ≡           ║
╠════════════════════════════════════════════════════════════════════════════════════════════════╣
║ 🏠 Seal                                                       ░░ [⚙️] ▼ ░░                    ║
║ ─────────────────────────────────────────────────────────────────────────────────────────────── ║
║                                                                                                  ║
║ ▓▓ 📄 Documents ▓▓                          ╭─────────────────────────────╮                   ║
║                                              │ ░░ ✏️ Rename Document ░░     │                   ║
║ ╔════════════════════════════════════════════│ ░░ 📁 Move to Folder ░░    │                   ║
║ ║                                            │ ░░ 🏷️ Edit Tags ░░         │                   ║
║ ║ ╭─────────╮  ▓▓ 📄 Contract.pdf ▓▓        │ ░░ 👥 Sharing Settings ░░   │                   ║
║ ║ │ ░░ 📄 ░░ │  3 pages • 1.2 MB • 2 days   │ ─────────────────────────────│                   ║
║ ║ │ ░ PAGE ░ │  Created by John Doe          │ ░░ 📄 Download PDF ░░       │                   ║
║ ║ │ ░ 1/3  ░ │  ░░ 📁 Legal Documents ░░     │ ░░ 📋 Document Details ░░   │                   ║
║ ║ ╰─────────╯                               │ ─────────────────────────────│                   ║
║ ║                                            │ ░░ 🗑️ Delete Document ░░    │                   ║
║ ║ ╭─────────╮  ▓▓ 📊 Quarterly-Report ▓▓    │ ╰─────────────────────────────╯                   ║
║ ║ │ ░░ 📊 ░░ │  1 page • 0.8 MB • 1 week                                                       ║
║ ║ │ ░CHART░ │  Created by John Doe                                                             ║
║ ║ │ ░     ░ │  ░░ 📁 Reports ░░                                                              ║
║ ║ ╰─────────╯                                                                                 ║
║ ║                                                                                            ║ ║
║ ╚════════════════════════════════════════════════════════════════════════════════════════════╝ ║
║                                                                                                  ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════╝

**shadcn/ui Component Mapping:**
- Settings dropdown: `DropdownMenu` with `DropdownMenuTrigger` and `DropdownMenuContent`
- Menu items: `DropdownMenuItem` components with appropriate icons
- Menu separators: `DropdownMenuSeparator` with `border-neutral-200` (#e5e5e5)
- Hover states: `hover:bg-neutral-100` (#f5f5f5) for menu items
- Destructive action: `DropdownMenuItem` with `text-red-600` (#dc2626) for delete

### Rename Document Dialog - Modal Overlay

╔════════════════════════════════════════════════════════════════════════════════════════════════╗
║ ● ● ●    🌐 https://seal.nyc/documents                        ⚪ ⚫ 🔍 ≡           ║
╠════════════════════════════════════════════════════════════════════════════════════════════════╣
║ 🏠 Seal                                    👤 John Doe    🔄 Pro Plan                            ║
║ ─────────────────────────────────────────────────────────────────────────────────────────────── ║
║ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░░░ ╔════════════════════════════════════════════════════════╗ ░░░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░░░ ║                ▓▓ ✏️ Rename Document ▓▓                ║ ░░░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░░░ ╠════════════════════════════════════════════════════════╣ ░░░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░░░ ║                                                        ║ ░░░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░░░ ║ Current name: ▓▓ Contract.pdf ▓▓                       ║ ░░░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░░░ ║                                                        ║ ░░░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░░░ ║ New name: ░░[Service-Agreement.pdf            ]░░      ║ ░░░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░░░ ║                                                        ║ ░░░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░░░ ║ ░░ 💡 The .pdf extension will be kept automatically ░░ ║ ░░░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░░░ ║                                                        ║ ░░░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░░░ ║                                                        ║ ░░░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░░░ ║                   ░░[Cancel]░░    ▓▓[Rename]▓▓          ║ ░░░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░░░ ║                                                        ║ ░░░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░░░ ╚════════════════════════════════════════════════════════╝ ░░░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════╝

**shadcn/ui Component Mapping:**
- Modal overlay: `Dialog` with `DialogOverlay` using `bg-neutral-500/20` opacity
- Dialog content: `DialogContent` with `bg-white` (#ffffff) and `border-neutral-200` (#e5e5e5)
- Dialog title: `DialogTitle` with `text-neutral-900` (#171717)
- Input field: `Input` component with focus states
- Helper text: `Text` with `text-neutral-600` (#525252) and info icon
- Cancel button: `Button` variant="outline" with `border-neutral-300` (#d4d4d8)
- Primary button: `Button` variant="default" with `bg-neutral-900` (#171717)

### Move to Folder Dialog - Modal Overlay

╔════════════════════════════════════════════════════════════════════════════════════════════════╗
║ ● ● ●    🌐 https://seal.nyc/documents                        ⚪ ⚫ 🔍 ≡           ║
╠════════════════════════════════════════════════════════════════════════════════════════════════╣
║ 🏠 Seal                                    👤 John Doe    🔄 Pro Plan                            ║
║ ─────────────────────────────────────────────────────────────────────────────────────────────── ║
║ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░ ╔════════════════════════════════════════════════════════════════╗ ░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░ ║                 ▓▓ 📁 Move Document ▓▓                       ║ ░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░ ╠════════════════════════════════════════════════════════════════╣ ░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░ ║                                                              ║ ░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░ ║ Move ▓▓"Contract.pdf"▓▓ to folder:                          ║ ░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░ ║                                                              ║ ░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░ ║ ▓▓ 📁 Folders ▓▓                                             ║ ░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░ ║ ╭────────────────────────────────────────────────────────╮   ║ ░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░ ║ │ ○ ░░ 📁 Legal Documents (current) ░░                  │   ║ ░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░ ║ │ ○ ░░ 📁 Reports ░░                                     │   ║ ░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░ ║ │ ○ ░░ 📁 Templates ░░                                   │   ║ ░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░ ║ │ ○ ░░ 📁 Archived ░░                                    │   ║ ░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░ ║ │ ● ▓▓ 📁 Active Contracts ▓▓                           │   ║ ░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░ ║ ╰────────────────────────────────────────────────────────╯   ║ ░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░ ║                                                              ║ ░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░ ║                    ░░ [+ Create New Folder] ░░               ║ ░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░ ║                                                              ║ ░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░ ║                  ░░[Cancel]░░          ▓▓[Move]▓▓            ║ ░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░ ║                                                              ║ ░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░ ╚════════════════════════════════════════════════════════════════╝ ░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════╝

**shadcn/ui Component Mapping:**
- Radio group: `RadioGroup` with `RadioGroupItem` for folder selection
- Folder options: `Label` components with folder icons and names
- Current folder indicator: Grayed out with `text-neutral-500` (#737373)
- Selected option: `RadioGroupItem` with `data-state="checked"`
- Create folder button: `Button` variant="outline" with plus icon
- Action buttons: `Button` variant="outline" for Cancel, variant="default" for Move

### Document Sharing Settings - Modal Overlay

╔════════════════════════════════════════════════════════════════════════════════════════════════╗
║ ● ● ●    🌐 https://seal.nyc/documents                        ⚪ ⚫ 🔍 ≡           ║
╠════════════════════════════════════════════════════════════════════════════════════════════════╣
║ 🏠 Seal                                    👤 John Doe    🔄 Pro Plan                            ║
║ ─────────────────────────────────────────────────────────────────────────────────────────────── ║
║ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░ ╔════════════════════════════════════════════════════════════════╗ ░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░ ║               ▓▓ 👥 Document Sharing ▓▓                       ║ ░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░ ╠════════════════════════════════════════════════════════════════╣ ░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░ ║                                                              ║ ░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░ ║ ▓▓ 📄 Contract.pdf ▓▓                                        ║ ░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░ ║                                                              ║ ░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░ ║ ▓▓ Workspace Access: ▓▓                                      ║ ░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░ ║ ● ░░ Private (only you can access) ░░                        ║ ░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░ ║ ○ ░░ Shared with workspace members ░░                        ║ ░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░ ║                                                              ║ ░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░ ║ ▓▓ External Sharing: ▓▓                                      ║ ░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░ ║ 🔗 Share via link: ░░ [Create Link] ░░                      ║ ░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░ ║ 📧 Send for signature: ░░ [Send Document] ░░                ║ ░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░ ║                                                              ║ ░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░ ║ ▓▓ 📋 Current Access: ▓▓                                     ║ ░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░ ║ 👤 John Doe (You) - Owner                                   ║ ░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░ ║                                                              ║ ░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░ ║                ░░[Cancel]░░        ▓▓[Save Settings]▓▓        ║ ░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░ ║                                                              ║ ░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░ ╚════════════════════════════════════════════════════════════════╝ ░░░░░░░░░░░░░░ ║
║ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════╝

**shadcn/ui Component Mapping:**
- Radio group for access: `RadioGroup` with `RadioGroupItem` for workspace access options
- External sharing buttons: `Button` variant="outline" for action buttons
- Current access list: `Card` component with user avatars and roles
- Owner badge: `Badge` variant="secondary" with neutral colors
- Action buttons: `Button` variant="outline" for Cancel, variant="default" for Save

---

## Document Organization Views

### Folder View - Desktop Browser

╔════════════════════════════════════════════════════════════════════════════════════════════════╗
║ ● ● ●    🌐 https://seal.nyc/documents/legal-documents    ⚪ ⚫ 🔍 ≡           ║
╠════════════════════════════════════════════════════════════════════════════════════════════════╣
║ 🏠 Seal                                    👤 John Doe    🔄 Pro Plan                            ║
║ ─────────────────────────────────────────────────────────────────────────────────────────────── ║
║                                                                                                  ║
║ ▓▓ 📄 Documents ▓▓ > ▓▓ 📁 Legal Documents ▓▓             ░░ [+ Upload Document] ░░           ║
║                                                                                                  ║
║ ░░ 🔍 [Search in Legal Documents...] ░░                    ░░ 📊 Sort: Recent ▼ ░░            ║
║                                                                                                  ║
║ ▓▓ 📁 Folders ▓▓                                                                                ║
║ ╔════════════════════════════════════════════════════════════════════════════════════════════╗ ║
║ ║ ░░ 📁 Legal Documents (5) ░░  ░░ 📁 Reports (3) ░░      ░░ 📁 Templates (2) ░░            ║ ║
║ ║ ░░ 📁 Active Contracts (8) ░░ ░░ 📁 Archived (12) ░░    ░░ [+ New Folder] ░░              ║ ║
║ ╚════════════════════════════════════════════════════════════════════════════════════════════╝ ║
║                                                                                                  ║
║ ▓▓ 📋 Documents in Legal Documents ▓▓                                                           ║
║ ╔════════════════════════════════════════════════════════════════════════════════════════════╗ ║
║ ║ ╭─────────╮  ▓▓ 📄 Contract.pdf ▓▓                               ░░[📝]░░ ░░[⚙️]░░       ║ ║
║ ║ │ ░░ 📄 ░░ │  3 pages • 1.2 MB • 2 days ago                                             ║ ║
║ ║ │ ░ PAGE ░ │  ░░ 🏷️ contracts, legal ░░                                                 ║ ║
║ ║ │ ░ 1/3  ░ │                                                                             ║ ║
║ ║ ╰─────────╯                                                                             ║ ║
║ ║                                                                                            ║ ║
║ ║ ╭─────────╮  ▓▓ 📄 NDA-Agreement.pdf ▓▓                 ░░[📝]░░ ░░[⚙️]░░             ║ ║
║ ║ │ ░░ 📄 ░░ │  5 pages • 2.3 MB • 2 weeks ago                                            ║ ║
║ ║ │ ░ PAGE ░ │  ░░ 🏷️ nda, legal, contracts ░░                                           ║ ║
║ ║ │ ░ 1/5  ░ │                                                                             ║ ║
║ ║ ╰─────────╯                                                                             ║ ║
║ ║                                                                                            ║ ║
║ ╚════════════════════════════════════════════════════════════════════════════════════════════╝ ║
║                                                                                                  ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════╝

**shadcn/ui Component Mapping:**
- Breadcrumb navigation: `Breadcrumb` component with `BreadcrumbItem` and `BreadcrumbSeparator`
- Folder grid: Custom grid layout with `Card` components for folder items
- Folder counters: `Badge` variant="secondary" showing document counts
- Create folder button: `Button` variant="outline" with plus icon
- Document list: `Card` components with consistent document card styling
- Tags: `Badge` variant="outline" with neutral colors

### Search Results View - Desktop Browser

╔════════════════════════════════════════════════════════════════════════════════════════════════╗
║ ● ● ●    🌐 https://seal.nyc/documents?q=contract         ⚪ ⚫ 🔍 ≡           ║
╠════════════════════════════════════════════════════════════════════════════════════════════════╣
║ 🏠 Seal                                    👤 John Doe    🔄 Pro Plan                            ║
║ ─────────────────────────────────────────────────────────────────────────────────────────────── ║
║                                                                                                  ║
║ ▓▓ 📄 Documents ▓▓                                        ░░ [+ Upload Document] ░░           ║
║                                                                                                  ║
║ ░░ 🔍 [contract                           ] 🔎 ░░                                              ║
║                                                                                                  ║
║ ▓▓ 📊 Search Results for "contract" (3 documents found) ▓▓                                     ║
║                                                                                                  ║
║ ╔════════════════════════════════════════════════════════════════════════════════════════════╗ ║
║ ║ ╭─────────╮  ▓▓ 📄 Contract.pdf ▓▓                               ░░[📝]░░ ░░[⚙️]░░       ║ ║
║ ║ │ ░░ 📄 ░░ │  3 pages • ░░ 📁 Legal Documents ░░                                          ║ ║
║ ║ │ ░ PAGE ░ │  Contains: "contract terms", "service contract"                             ║ ║
║ ║ │ ░ 1/3  ░ │                                                                             ║ ║
║ ║ ╰─────────╯                                                                             ║ ║
║ ║                                                                                            ║ ║
║ ║ ╭─────────╮  ▓▓ 📄 Service-Contract.pdf ▓▓              ░░[📝]░░ ░░[⚙️]░░             ║ ║
║ ║ │ ░░ 📄 ░░ │  8 pages • ░░ 📁 Active Contracts ░░                                      ║ ║
║ ║ │ ░ PAGE ░ │  Contains: "contract agreement", "contractor"                            ║ ║
║ ║ │ ░ 1/8  ░ │                                                                             ║ ║
║ ║ ╰─────────╯                                                                             ║ ║
║ ║                                                                                            ║ ║
║ ║ ╭─────────╮  ▓▓ 📄 Employment-Contract.pdf ▓▓          ░░[📝]░░ ░░[⚙️]░░             ║ ║
║ ║ │ ░░ 📄 ░░ │  6 pages • ░░ 📁 HR Documents ░░                                          ║ ║
║ ║ │ ░ PAGE ░ │  Contains: "employment contract", "contract terms"                       ║ ║
║ ║ │ ░ 1/6  ░ │                                                                             ║ ║
║ ║ ╰─────────╯                                                                             ║ ║
║ ║                                                                                            ║ ║
║ ╚════════════════════════════════════════════════════════════════════════════════════════════╝ ║
║                                                                                                  ║
║                                    ░░ [Clear Search] ░░                                        ║
║                                                                                                  ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════╝

**shadcn/ui Component Mapping:**
- Search input: `Input` component with search icon and clear functionality
- Search results header: `Typography` h3 with result count
- Content highlights: Search terms in content preview with `bg-yellow-100` (#fef3c7) highlighting
- Clear search button: `Button` variant="ghost" to reset search state
- Results list: Same document card styling as folder view with search-specific content previews

---

## Mobile Document Management

### Mobile Document List - iPhone Frame

┌───────────────────────────────────────┐
│  9:41 AM        ●●●     🔋 85% ●●●●   │ ← Status bar
├───────────────────────────────────────┤
│ 🏠 Seal         👤 John ☰          │ ← Header
├───────────────────────────────────────┤
│                                       │
│ ▓▓ 📄 Documents ▓▓          ░░[+]░░   │ ← Section title
│                                       │
│ ░░ 🔍 [Search...] ░░                  │ ← Search input
│                                       │
│ ╔═══════════════════════════════════╗ │
│ ║╭──╮ ▓▓Contract.pdf▓▓      ░░[⚙️]░░║ │
│ ║│📄│ 3 pages • 2 days              ║ │
│ ║╰──╯ ░░Legal Documents░░            ║ │
│ ╚═══════════════════════════════════╝ │
│                                       │
│ ╔═══════════════════════════════════╗ │
│ ║╭──╮ ▓▓Report.xlsx → PDF▓▓ ░░[⚙️]░░║ │
│ ║│📊│ 1 page • 1 week               ║ │
│ ║╰──╯ ░░Reports░░                   ║ │
│ ╚═══════════════════════════════════╝ │
│                                       │
│ ╔═══════════════════════════════════╗ │
│ ║╭──╮ ▓▓NDA.pdf▓▓            ░░[⚙️]░░║ │
│ ║│📄│ 5 pages • 2 weeks             ║ │
│ ║╰──╯ ░░Legal • contracts░░          ║ │
│ ╚═══════════════════════════════════╝ │
│                                       │
│          ░░[Load More]░░               │
│                                       │
└───────────────────────────────────────┘
│                                       │ ← Home indicator area
└───────────────────────────────────────┘

**shadcn/ui Component Mapping:**
- Mobile header: Custom header with hamburger menu
- Document cards: `Card` components optimized for mobile touch targets
- File type icons: Smaller icon containers for mobile
- Search input: `Input` component with mobile-friendly sizing
- Load more: `Button` variant="ghost" for infinite scroll trigger

### Mobile Document Preview - iPhone Frame

┌───────────────────────────────────────┐
│  9:41 AM        ●●●     🔋 85% ●●●●   │ ← Status bar
├───────────────────────────────────────┤
│ ░░← Contract.pdf░░         ░░[⚙️]░░    │ ← Navigation header
├───────────────────────────────────────┤
│                                       │
│ ╔═══════════════════════════════════╗ │
│ ║ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ ║ │
│ ║ ░░                             ░░ ║ │
│ ║ ░░      PDF PAGE               ░░ ║ │
│ ║ ░░     CONTENT                 ░░ ║ │
│ ║ ░░      PAGE 1                 ░░ ║ │
│ ║ ░░                             ░░ ║ │
│ ║ ░░ [Document content           ░░ ║ │
│ ║ ░░  rendered here for          ░░ ║ │
│ ║ ░░  mobile viewing]            ░░ ║ │
│ ║ ░░                             ░░ ║ │
│ ║ ░░                             ░░ ║ │
│ ║ ░░                             ░░ ║ │
│ ║ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ ║ │
│ ╚═══════════════════════════════════╝ │
│                                       │
│ ░░◀️ Prev░░   ▓▓1/3▓▓   ░░Next ▶️░░    │
│                                       │
│ ▓▓[📝 Add Fields]▓▓  ░░[👥 Share]░░    │
│                                       │
└───────────────────────────────────────┘
│                                       │ ← Home indicator area
└───────────────────────────────────────┘

**shadcn/ui Component Mapping:**
- Mobile navigation: Custom header with back button and menu
- PDF viewer: Custom mobile-optimized PDF renderer with touch gestures
- Page controls: Mobile pagination with touch-friendly targets
- Action buttons: `Button` components sized for mobile touch (minimum 44px height)
- Primary actions: `Button` variant="default" for key actions like "Add Fields"
- Secondary actions: `Button` variant="outline" for supporting actions

These wireframes provide comprehensive coverage of document preview and management functionality while maintaining the clean, focused design philosophy and properly integrating the freemium model throughout the experience.