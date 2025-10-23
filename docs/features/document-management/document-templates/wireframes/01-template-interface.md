                       ▓▓▓ SEAL LOGO ▓▓▓
     ╔══════════════════════════════════════════════════════════════════════════════════════════════╗
     ║                          📝 DOCUMENT TEMPLATES WIREFRAMES                                     ║
     ╚══════════════════════════════════════════════════════════════════════════════════════════════╝

## Template Interface Wireframes

### Template Creation from Prepared Document
[Modal Component: Dialog with form validation]
[Mobile Viewport: Full-screen modal on small screens]

```
╔════════════════════════════════════════════════════════════════════════════════════════════════╗
║ [Dialog: title="Create Template from Document"] Create Template from Document         [Button: variant="ghost" ✕] ║
╠════════════════════════════════════════════════════════════════════════════════════════════════╣
║                                                                                                  ║
║  📄 Save Document as Template                                                                    ║
║                                                                                                  ║
║  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓║
║  ┃                                                                                              ┃║
║  ┃   [Card: className="border"] Current Document: service-agreement.pdf                        ┃║
║  ┃   12 pages • 5 signature fields • 2 recipients                                              ┃║
║  ┃                                                                                              ┃║
║  ┃   Template Name:                                                                             ┃║
║  ┃   Template Name: [Input: variant="outline" className="w-full" placeholder="Service Agreement Template"] ┃║
║  ┃                                                                                              ┃║
║  ┃   Description:                                                                                 ┃║
║  ┃   [Textarea: variant="outline" rows={3}] Standard service agreement with payment terms and project deliverables ┃║
║  ┃                                                                                              ┃║
║  ┃   Template will include:                                                                       ┃║
║  ┃   [Checkbox: checked] ✅ All signature fields and positions                                  ┃║
║  ┃   [Checkbox: checked] ✅ Recipient roles (Client, Service Provider)                          ┃║
║  ┃   [Checkbox: checked] ✅ Document structure and layout                                       ┃║
║  ┃                                                                                              ┃║
║  ┃   📤 Sharing:                                                                                ┃║
║  ┃   [RadioGroup: value="private"]                                                              ┃║
║  ┃   • Private (only you)                                                                      ┃║
║  ┃   ◦ Workspace (all team members)                                                            ┃║
║  ┃                                                                                              ┃║
║  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛║
║                                                                                                  ║
║  [Button: variant="outline"] Cancel                          [Button: variant="default"] Create Template ║
║                                                                                                  ║
╚════════════════════════════════════════════════════════════════════════════════════════════════╝
```

### Template Library Interface
[Component: Grid layout with template cards and filtering]
[Mobile Viewport: 1-column template cards with larger thumbnails]

```
╔════════════════════════════════════════════════════════════════════════════════════════════════╗
║ ● ● ●    🌐 https://seal.nyc/templates                  ⚪ ⚫ 🔍 ≡           ║
║ 🏠 Seal                                              [Button: variant="ghost"] [Button: variant="ghost"] ║
╠════════════════════════════════════════════════════════════════════════════════════════════════╣
║ Templates                                                                                        ║
╠════════════════════════════════════════════════════════════════════════════════════════════════╣
║                                                                                                  ║
║  [Input: placeholder="Search templates..." className="w-64"] [Button: variant="default" + New]    ║
║                                                                                                  ║
║  [Tabs: value="my"] 📂 My Templates (4)        📂 Workspace Templates (7)                ║
║                                                                                                  ║
║  [Grid: className="grid-cols-3 gap-4"]                                                          ║
║  ┏━━━━━━━━━━━━━━━┓ ┏━━━━━━━━━━━━━━━┓ ┏━━━━━━━━━━━━━━━━━┓║
║  ┃[Card] 📄         ┃ ┃[Card] 📄         ┃ ┃[Card] 📄           ┃║
║  ┃Service        ┃ ┃NDA Template   ┃ ┃Employment       ┃║
║  ┃Agreement      ┃ ┃               ┃ ┃Contract         ┃║
║  ┃Template       ┃ ┃Used 12 times  ┃ ┃                 ┃║
║  ┃               ┃ ┃               ┃ ┃Created by Jane  ┃║
║  ┃Used 8 times   ┃ ┃[Button] Use   ┃ ┃                 ┃║
║  ┃[Button] Use   ┃ ┃[Button] Edit  ┃ ┃[Button] Use     ┃║
║  ┃[Button] Edit  ┃ ┗━━━━━━━━━━━━━━━┛ ┃[Button] ⭐       ┃║
║  ┗━━━━━━━━━━━━━━━┛                   ┗━━━━━━━━━━━━━━━━━┛║
║                                                                                                  ║
║  ┃[Card] 📄         ┃ ┃[Card] 📄         ┃ ┃[Card] 📄           ┃║
║  ┃Partnership    ┃ ┃Sales Contract ┃ ┃Consultant       ┃║
║  ┃Agreement      ┃ ┃Template       ┃ ┃Agreement        ┃║
║  ┃               ┃ ┃               ┃ ┃                 ┃║
║  ┃Used 3 times   ┃ ┃Used 15 times  ┃ ┃Created by Mike  ┃║
║  ┃[Button] Use   ┃ ┃[Button] Use   ┃ ┃[Button] Use     ┃║
║  ┃[Button] Edit  ┃ ┃[Button] Edit  ┃ ┃[Button] ⭐       ┃║
║  ┗━━━━━━━━━━━━━━━┛ ┗━━━━━━━━━━━━━━━┛ ┗━━━━━━━━━━━━━━━━━┛║
║                                                                                                  ║
╚════════════════════════════════════════════════════════════════════════════════════════════════╝
```

### Template Preview and Selection
[Modal Component: Dialog with preview area and metadata display]
[Desktop Viewport: 1200px width with detailed template information]

```
╔═════════════════════════════════════════════════════════════════════════════════════════════════╗
║ [Dialog: title="Service Agreement Template"] Service Agreement Template      [Button: variant="ghost" ✕] ║
╠═════════════════════════════════════════════════════════════════════════════════════════════════╣
║                                                                                                 ║
║  📄 Template Preview                                                                            ║
║                                                                                                 ║
║  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓║
║  ┃                                                                                             ┃║
║  ┃         [Card: className="bg-muted"] Document Preview Area                                 ┃║
║  ┃                                                                                             ┃║
║  ┃    📄 Page 1 of 12                                                                         ┃║
║  ┃                                                                                             ┃║
║  ┃    [Badge: variant="secondary"] • 5 signature fields configured                           ┃║
║  ┃    [Badge: variant="secondary"] • 2 recipient roles defined                               ┃║
║  ┃    [Badge: variant="default"] • Ready for immediate use                                   ┃║
║  ┃                                                                                             ┃║
║  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛║
║                                                                                                 ║
║  📊 Template Details:                                                                           ║
║  • Created: March 15, 2024                                                                     ║
║  • Used: 8 times                                                                               ║
║  • Last used: 2 days ago                                                                       ║
║  • Created by: You                                                                             ║
║                                                                                                 ║
║  👥 Recipient Roles:                                                                           ║
║  • Client (2 signature fields)                                                                 ║
║  • Service Provider (3 signature fields)                                                       ║
║                                                                                                 ║
║  [Button: variant="outline"] ◀ Back to Templates    [Button: variant="default"] Use This Template ║
║                                                                                                 ║
╚═════════════════════════════════════════════════════════════════════════════════════════════════╝
```

### Template Application - Recipient Mapping
[Modal Component: Dialog with form for recipient assignment and message customization]
[Mobile Viewport: Full-screen modal with stacked form fields]

```
╔═════════════════════════════════════════════════════════════════════════════════════════════════╗
║ [Dialog: title="Use Template: Service Agreement Template"] Use Template          [Button: variant="ghost" ✕] ║
╠═════════════════════════════════════════════════════════════════════════════════════════════════╣
║                                                                                                 ║
║  👥 Assign Recipients to Template Roles                                                         ║
║                                                                                                 ║
║  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓║
║  ┃                                                                                             ┃║
║  ┃   📋 Client (2 signature fields)                                                           ┃║
║  ┃   Name: [Input: value="John Smith" className="w-full"]                                     ┃║
║  ┃   Email: [Input: value="john@clientcompany.com" className="w-full"]                        ┃║
║  ┃                                                                                             ┃║
║  ┃   📋 Service Provider (3 signature fields)                                                 ┃║
║  ┃   Name: [Input: value="Your Company" className="w-full"]                                   ┃║
║  ┃   Email: [Input: value="you@yourcompany.com" className="w-full"]                           ┃║
║  ┃                                                                                             ┃║
║  ┃   📄 Document Title:                                                                       ┃║
║  ┃   [Input: value="Q1 2024 Service Agreement - John Smith" className="w-full"]              ┃║
║  ┃                                                                                             ┃║
║  ┃   📝 Message to Recipients:                                                                ┃║
║  ┃   [Textarea: variant="outline" rows={3}]                                                   ┃║
║  ┃   Please review and sign this service agreement for our Q1 2024 project.                  ┃║
║  ┃                                                                                             ┃║
║  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛║
║                                                                                                 ║
║  [Button: variant="outline"] ◀ Choose Different Template   [Button: variant="default"] Create Document → ║
║                                                                                                 ║
╚═════════════════════════════════════════════════════════════════════════════════════════════════╝
```

---

## Template Management Interfaces

### Template Editing Interface
[Component: Full-page template editor with signature field overlay]
[Desktop Viewport: 1200px width with field editing tools and sidebar]

```
╔═════════════════════════════════════════════════════════════════════════════════════════════════╗
║ [Breadcrumb: separator="/"] Seal                                        [Button: variant="ghost" ☰] [Button: variant="ghost" ⚙] ║
╠═════════════════════════════════════════════════════════════════════════════════════════════════╣
║ Edit Template: Service Agreement Template                                                       ║
╠═════════════════════════════════════════════════════════════════════════════════════════════════╣
║                                                                                                 ║
║  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓║
║  ┃                                                                                             ┃║
║  ┃         [Card: className="border-dashed p-4"] Document with Signature Fields              ┃║
║  ┃                                                                                             ┃║
║  ┃    📝 [Input: variant="outline" placeholder="Client Signature"]      [Date: format="MM/DD/YYYY"] ┃║
║  ┃    📝 [Input: variant="outline" placeholder="Service Provider"]  [Input: variant="outline" placeholder="Witness"] ┃║
║  ┃    📝 [Input: variant="outline" placeholder="Initial Here"]                          ┃║
║  ┃                                                                                             ┃║
║  ┃    [Toolbar] [Button: variant="default" icon="➕"] Add Field [Button: variant="outline" icon="✏️"] Edit [Button: variant="destructive" icon="🗑️"] Delete ┃║
║  ┃                                                                                             ┃║
║  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛║
║                                                                                                 ║
║  [Card: variant="outline"] Template Settings:                                                   ║
║  Name: [Input: value="Service Agreement Template" className="w-full"] [Button: variant="ghost" ✏️] ║
║  Roles: Client, Service Provider            [Button: variant="ghost" ✏️]                      ║
║  Sharing: [RadioGroup: value="private"] 🔘 Private  ⚪ Workspace    [Button: variant="ghost" ✏️]      ║
║                                                                                                 ║
║  [Button: variant="outline"] Cancel Changes                    [Button: variant="default"] Save Template ║
║                                                                                                 ║
╚═════════════════════════════════════════════════════════════════════════════════════════════════╝
```

### Template Sharing Settings
[Modal Component: Dialog with sharing configuration and permissions]
[Mobile Viewport: Full-screen modal with stacked form elements]

```
╔═════════════════════════════════════════════════════════════════════════════════════════════════╗
║ [Dialog: title="Template Sharing Settings"] Template Sharing Settings         [Button: variant="ghost" ✕] ║
╠═════════════════════════════════════════════════════════════════════════════════════════════════╣
║                                                                                                 ║
║  📤 Share Template with Workspace                                                              ║
║                                                                                                 ║
║  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓║
║  ┃                                                                                             ┃║
║  ┃   📄 Service Agreement Template                                                             ┃║
║  ┃                                                                                             ┃║
║  ┃   [Badge: variant="outline"] Current Access: Private (only you)                           ┃║
║  ┃                                                                                             ┃║
║  ┃   [Alert: variant="default" icon="🔄"] Change to: Workspace Shared                         ┃║
║  ┃                                                                                             ┃║
║  ┃   Team Description:                                                                         ┃║
║  ┃   [Textarea: variant="outline" rows={3}]                                                   ┃║
║  ┃   Standard service agreement template for client projects. Includes payment terms and      ┃║
║  ┃   deliverable specifications.                                                               ┃║
║  ┃                                                                                             ┃║
║  ┃   👥 Team members will be able to:                                                         ┃║
║  ┃   [Checkbox: checked] ✅ Use this template for new documents                               ┃║
║  ┃   [Checkbox: checked] ✅ View template structure and fields                                ┃║
║  ┃   [Checkbox: unchecked] ⚪ Edit template (optional)                                           ┃║
║  ┃                                                                                             ┃║
║  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛║
║                                                                                                 ║
║  [Button: variant="outline"] Keep Private                    [Button: variant="default"] Share with Team ║
║                                                                                                 ║
╚═════════════════════════════════════════════════════════════════════════════════════════════════╝
```

---

## Template Creation from Scratch

### New Template Creation Interface
[Modal Component: Dialog with file upload and template configuration]
[Desktop Viewport: 1200px width with drag-and-drop area and form fields]

```
╔═════════════════════════════════════════════════════════════════════════════════════════════════╗
║ [Dialog: title="Create New Template"] Create New Template                   [Button: variant="ghost" ✕] ║
╠═════════════════════════════════════════════════════════════════════════════════════════════════╣
║                                                                                                 ║
║  📄 Start with Base Document                                                                    ║
║                                                                                                 ║
║  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓║
║  ┃                                                                                             ┃║
║  ┃   📤 Upload Document                                                                       ┃║
║  ┃   [Card: className="border-dashed border-2 p-8 text-center"]                             ┃║
║  ┃                                                                                             ┃║
║  ┃         Drag & Drop PDF Here                                                            ┃║
║  ┃              or                                                                         ┃║
║  ┃         [Button: variant="outline"] Browse Files                                        ┃║
║  ┃                                                                                             ┃║
║  ┃                                                                                             ┃║
║  ┃   📋 Template Information                                                                  ┃║
║  ┃   Name: [Input: placeholder="New Template" className="w-full"]                             ┃║
║  ┃   Description: [Textarea: placeholder="Describe template purpose..." rows={2}]             ┃║
║  ┃                                                                                             ┃║
║  ┃   👥 Default Recipient Roles:                                                             ┃║
║  ┃   • [Input: value="Signer 1" className="w-48"] [Button: variant="ghost" ➕] [Button: variant="ghost" ➖] ┃║
║  ┃   • [Input: value="Signer 2" className="w-48"] [Button: variant="ghost" ➕] [Button: variant="ghost" ➖] ┃║
║  ┃   [Button: variant="outline" icon="➕"] Add Role                                            ┃║
║  ┃                                                                                             ┃║
║  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛║
║                                                                                                 ║
║  [Button: variant="outline"] Cancel                          [Button: variant="default"] Create & Edit → ║
║                                                                                                 ║
╚═════════════════════════════════════════════════════════════════════════════════════════════════╝
```

---

## Template Error Handling Interfaces

### Template Creation Error
[Alert Component: Dialog with error details and recovery options]
[Mobile Viewport: Full-screen error dialog with action buttons]

```
╔═════════════════════════════════════════════════════════════════════════════════════════════════╗
║ [Dialog: title="Template Creation Failed"] Template Creation Failed          [Button: variant="ghost" ✕] ║
╠═════════════════════════════════════════════════════════════════════════════════════════════════╣
║                                                                                                 ║
║  [Alert: variant="destructive" icon="❌"] Template creation failed                                   ║
║                                                                                                 ║
║  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓║
║  ┃                                                                                             ┃║
║  ┃   📄 service-agreement.pdf                                                                 ┃║
║  ┃                                                                                             ┃║
║  ┃   [Alert: variant="destructive" icon="⚠️"] What went wrong:                                      ┃║
║  ┃   The document format could not be processed for template creation.                       ┃║
║  ┃                                                                                             ┃║
║  ┃   [Alert: variant="default" icon="✅"] Your options:                                             ┃║
║  ┃   • Try again with template creation                                                       ┃║
║  ┃   • Edit document and retry                                                                ┃║
║  ┃   • Continue sending without creating template                                             ┃║
║  ┃                                                                                             ┃║
║  ┃   [Alert: variant="default" icon="ℹ️"] Your document and signature fields are still ready        ┃║
║  ┃   to send - template creation is optional.                                                 ┃║
║  ┃                                                                                             ┃║
║  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛║
║                                                                                                 ║
║  [Button: variant="outline" icon="🔄"] Try Again [Button: variant="outline" icon="📝"] Edit Document [Button: variant="default" icon="📤"] Send Document ║
║                                                                                                 ║
╚═════════════════════════════════════════════════════════════════════════════════════════════════╝
```

### Template Application Error
[Alert Component: Dialog with application error details and alternatives]
[Mobile Viewport: Full-screen error dialog with recovery options]

```
╔═════════════════════════════════════════════════════════════════════════════════════════════════╗
║ [Dialog: title="Template Application Error"] Template Application Error        [Button: variant="ghost" ✕] ║
╠═════════════════════════════════════════════════════════════════════════════════════════════════╣
║                                                                                                 ║
║  [Alert: variant="destructive" icon="❌"] Template couldn't be applied                               ║
║                                                                                                 ║
║  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓║
║  ┃                                                                                             ┃║
║  ┃   📄 Service Agreement Template                                                             ┃║
║  ┃                                                                                             ┃║
║  ┃   [Alert: variant="destructive" icon="⚠️"] Issue:                                                ┃║
║  ┃   Some template fields couldn't be applied to create the new document.                    ┃║
║  ┃                                                                                             ┃║
║  ┃   [Alert: variant="default" icon="✅"] Your options:                                             ┃║
║  ┃   • Try a different template                                                                ┃║
║  ┃   • Create document manually                                                                ┃║
║  ┃   • Report this template issue                                                              ┃║
║  ┃                                                                                             ┃║
║  ┃   [Alert: variant="default" icon="💡"] Tip: You can still create your document by uploading      ┃║
║  ┃   a PDF and adding fields manually.                                                       ┃║
║  ┃                                                                                             ┃║
║  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛║
║                                                                                                 ║
║  [Button: variant="outline" icon="🔍"] Try Different Template [Button: variant="default" icon="📤"] Create Manually [Button: variant="ghost" icon="❓"] Report ║
║                                                                                                 ║
╚═════════════════════════════════════════════════════════════════════════════════════════════════╝
```

---

## Mobile Template Interface

### Mobile Template Library
[Component: Mobile-optimized template library with search and cards]
[Mobile Viewport: 375px width with stacked template cards]

```
╔═════════════════════════════════════════╗
║ [Header] Seal Templates        [Button: variant="ghost" ☰] ║
╠═════════════════════════════════════════╣
║                                         ║
║ [Input: icon="🔍" placeholder="Search..."] [Button: variant="default" +] ║
║                                         ║
║ [Badge: variant="secondary" icon="📂"] My Templates (4) ║
║                                         ║
║ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ ║
║ ┃[Card] 📄 Service Agreement Template    ┃ ║
║ ┃   Used 8 times                         ┃ ║
║ ┃   [Button: size="sm"] Use [Button: size="sm"] Edit ┃ ║
║ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ ║
║                                         ║
║ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ ║
║ ┃[Card] 📄 NDA Template                ┃ ║
║ ┃   Used 12 times                        ┃ ║
║ ┃   [Button: size="sm"] Use [Button: size="sm"] Edit ┃ ║
║ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ ║
║                                         ║
║ [Badge: variant="secondary" icon="📂"] Workspace Templates ║
║                                         ║
║ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ ║
║ ┃[Card] 📄 Employment Contract           ┃ ║
║ ┃   by Jane Smith                        ┃ ║
║ ┃   [Button: size="sm"] Use [Button: size="sm" ⭐] ┃ ║
║ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ ║
║                                         ║
╚═════════════════════════════════════════╝
```

### Mobile Template Application
[Modal Component: Full-screen mobile form for template application]
[Mobile Viewport: 375px width with stacked form fields and native inputs]

```
╔═════════════════════════════════════════╗
║ [Dialog: title="Use Template"] Use Template [Button: variant="ghost" ✕] ║
╠═════════════════════════════════════════╣
║                                         ║
║ 👥 Assign Recipients                     ║
║                                         ║
║ [Label] 📋 Client                        ║
║ Name: [Input: value="John Smith" className="w-full"] ║
║ Email: [Input: value="john@co.com" className="w-full"] ║
║                                         ║
║ [Label] 📋 Service Provider               ║
║ Name: [Input: value="Your Company" className="w-full"] ║
║ Email: [Input: value="you@co.com" className="w-full"] ║
║                                         ║
║ [Label] 📄 Document Title:                ║
║ [Input: value="Q1 Service Agreement" className="w-full"] ║
║                                         ║
║ [Label] 📝 Message:                       ║
║ [Textarea: rows={3} className="w-full"]     ║
║ Please review and sign this agreement      ║
║                                         ║
║ [Button: variant="outline"] ◀ Back [Button: variant="default"] Create Doc → ║
║                                         ║
╚═════════════════════════════════════════╝
```

---

## Template Independence Confirmation

### Template Update Confirmation
[Alert Component: Success dialog with template independence explanation]
[Desktop Viewport: 1200px width with detailed confirmation message]

```
╔═════════════════════════════════════════════════════════════════════════════════════════════════╗
║ [Dialog: title="Template Updated Successfully"] Template Updated Successfully     [Button: variant="ghost" ✕] ║
╠═════════════════════════════════════════════════════════════════════════════════════════════════╣
║                                                                                                 ║
║  [Alert: variant="default" icon="✅"] Service Agreement Template updated!                         ║
║                                                                                                 ║
║  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓║
║  ┃                                                                                             ┃║
║  ┃   [Alert: variant="default" icon="📄"] Template changes saved successfully                        ┃║
║  ┃                                                                                             ┃║
║  ┃   [Alert: variant="default" icon="✅"] Changes will apply to:                                    ┃║
║  ┃   • New documents created from this template                                                ┃║
║  ┃                                                                                             ┃║
║  ┃   [Alert: variant="secondary" icon="ℹ️"] No impact on:                                            ┃║
║  ┃   • Existing documents (8 documents)                                                       ┃║
║  ┃   • Documents currently being signed                                                       ┃║
║  ┃   • Completed documents                                                                     ┃║
║  ┃                                                                                             ┃║
║  ┃   [Alert: variant="default" icon="🔗"] Template Independence:                                    ┃║
║  ┃   Templates and documents are completely separate after document creation. You can freely   ┃║
║  ┃   edit templates without affecting existing documents.                                     ┃║
║  ┃                                                                                             ┃║
║  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛║
║                                                                                                 ║
║  [Button: variant="outline" icon="📚"] Back to Templates [Button: variant="default" icon="📝"] Use Updated Template ║
║                                                                                                 ║
╚═════════════════════════════════════════════════════════════════════════════════════════════════╝
```

This completes the comprehensive wireframes for the document templates feature, covering all the simplified flows while maintaining focus on clean user experience and template independence.