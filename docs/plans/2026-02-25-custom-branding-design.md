# Custom Branding / White-Label — Design Document

## Goal

Allow organizations to customize the signing experience with their own branding — logo, colors, email sender name — so recipients see the sender's brand, not Seal's. Critical for agencies and consultants who embed document signing into their client workflows.

## Current State

- Organization schema has a `logo` field (URL string) but it's not used on the signing page
- Signing page (`/sign/$token`) hardcodes `<SealLogo>` in the header
- Email templates use `FROM_EMAIL = "Seal <no-reply@seal.nyc>"` — no per-org customization
- No brand color, font, or custom domain support anywhere
- Stripe appearance is hardcoded in `stripe-theme.ts`

## Design

### Branding Configuration

Add a `brandingSettings` object to the organization schema:

```typescript
brandingSettings: v.optional(v.object({
  // Visual identity
  logoStorageId: v.optional(v.id("_storage")),  // Uploaded logo (Convex storage)
  logoUrl: v.optional(v.string()),               // Serving URL (generated)
  brandColor: v.optional(v.string()),            // Primary brand color (hex, e.g., "#0d9488")
  accentColor: v.optional(v.string()),           // Secondary color (hex)

  // Email customization
  emailFromName: v.optional(v.string()),         // e.g., "Acme Legal" instead of "Seal"
  emailReplyTo: v.optional(v.string()),          // Reply-to address

  // Signing page
  hideSealbrand: v.optional(v.boolean()),        // Pro: hide "Powered by Seal" footer
  customFooterText: v.optional(v.string()),      // e.g., "Acme Corp — Confidential"

  // Feature flag
  enabled: v.boolean(),                          // Master switch
}))
```

### Where Branding Applies

| Surface | What Changes |
|---------|-------------|
| **Signing page header** | Org logo replaces Seal logo. Brand color applied to primary buttons and progress indicators. |
| **Signing page footer** | Free plan: "Powered by Seal" shown. Pro plan with `hideSealbrand`: org's custom footer text or nothing. |
| **Invitation emails** | `emailFromName` in From header. Org logo in email header. Brand color for CTA button. |
| **Reminder emails** | Same as invitation emails. |
| **Completion emails** | Same branding. |
| **Certificate of completion PDF** | Org logo in header instead of Seal logo (if logo uploaded). |
| **Signing page Stripe payment form** | Brand color passed to Stripe `appearance.variables.colorPrimary`. |

### What Branding Does NOT Affect (v1)

- The authenticated web app (dashboard, settings, etc.) — stays Seal-branded
- Custom domains (e.g., `sign.acme.com`) — complex (DNS, SSL), defer to v2
- Custom email domains (SPF/DKIM) — requires Resend domain verification, defer to v2
- Custom fonts — too complex for v1, stick with system fonts

### Settings UI

New page: **`/{slug}/settings/branding`**

Layout:
- **Logo upload**: Drag-drop or file picker. Max 2MB, PNG/SVG/JPG. Preview shown at signing page scale.
- **Colors**: Brand color picker + accent color picker. Live preview swatch.
- **Email**: From name input, reply-to email input (validated).
- **Signing page**: Toggle "Hide Seal branding" (Pro only, shows upgrade prompt for Free). Custom footer text input.
- **Preview button**: Opens a mock signing page in a new tab showing how the branding looks.

### Implementation Details

#### Signing Page Changes (`sign.$token.tsx`)

The `getRecipientByToken` query already returns the document + organization data. Extend it to include `brandingSettings` from the org.

```
// Pseudocode for signing page header
if (org.brandingSettings?.enabled && org.brandingSettings?.logoUrl) {
  render <img src={org.brandingSettings.logoUrl} />
} else {
  render <SealLogo />
}

// Primary button color
const brandColor = org.brandingSettings?.brandColor || "#0d9488"  // Seal teal default
```

CSS custom properties injected at the signing page root:
```css
--brand-primary: {brandColor};
--brand-accent: {accentColor};
```

Signing page buttons, progress bar, and active states use these variables.

#### Email Template Changes

Email templates in `packages/transactional/` receive branding props:
```typescript
interface BrandingProps {
  logoUrl?: string
  brandColor?: string
  fromName?: string
}
```

The `sendDocumentInvitation()` function in `email.ts` queries the org's branding settings and passes them to the email renderer. The `from` field in the Resend API call uses `emailFromName` if set.

#### Logo Storage

- Upload via `generateUploadUrl` mutation (existing Convex pattern)
- Store `storageId` on org record
- Generate serving URL via `getUrl` and cache it on `logoUrl` field
- Max dimensions: 400x100px (auto-resized client-side before upload)

### Permissions

- New permission: `branding:manage` — Admin and Owner roles only
- Viewing branding settings: any authenticated member can see (for preview)

### Plan Gating

| Feature | Free | Pro |
|---------|------|-----|
| Custom logo | Yes | Yes |
| Brand color | Yes | Yes |
| Email from name | No | Yes |
| Hide "Powered by Seal" | No | Yes |
| Custom footer text | No | Yes |

### Key Files to Modify/Create

| File | Action |
|------|--------|
| `apps/backend/convex/schemas/organizations.ts` | Modify — add `brandingSettings` |
| `apps/backend/convex/organizations/mutations.ts` | Modify — add `updateBrandingSettings` mutation |
| `apps/backend/convex/documents/recipients_queries.ts` | Modify — include branding in token query response |
| `apps/web/src/routes/sign.$token.tsx` | Modify — apply branding to header/footer/colors |
| `apps/web/src/routes/_authenticated/$slug/settings/branding.tsx` | Create — branding settings page |
| `packages/transactional/` | Modify — accept branding props in all email templates |
| `apps/backend/convex/documents/email.ts` | Modify — pass branding to email renderer |
| `apps/backend/convex/documents/certificate_of_completion.ts` | Modify — use org logo |
| `apps/backend/convex/auth/permissions.ts` | Modify — add `branding:manage` |
