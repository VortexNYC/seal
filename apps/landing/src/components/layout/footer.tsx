import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";

/* ── Legal modal content ─────────────────────────────────────────────────── */
const PRIVACY_CONTENT = `
## Privacy Policy

**Effective date:** January 1, 2025

### What we collect
We collect information you provide directly (name, email, company) when you join the waitlist, sign up after an invitation, send documents, or contact us. We also collect usage data (pages visited, features used, device type) automatically.

### How we use it
- To operate and improve Seal
- To send transactional emails (document notifications, receipts)
- To respond to support requests
- We do **not** sell your data to third parties. Ever.

### Data storage
Data is stored on servers in the United States. We use industry-standard encryption at rest (AES-256) and in transit (TLS 1.2+).

### Document content
Documents you upload are processed to extract fields and signatures. We do not read or use your document content for any purpose other than operating the service. Document content is deleted upon account termination.

### Your rights
You may request access to, correction of, or deletion of your data at any time by emailing **privacy@seal.co**.

### Cookies
We use essential cookies for session management and optional analytics cookies (PostHog). You may opt out of analytics via your account settings.

### Changes
We will notify you by email of material changes to this policy.

**Contact:** privacy@seal.co
`;

const TERMS_CONTENT = `
## Terms of Service

**Effective date:** January 1, 2025

### 1. Acceptance
By using Seal, you agree to these terms. If you don't agree, don't use the service.

### 2. The service
Seal provides document signing, payment collection, and AI document review tools. We reserve the right to modify or discontinue features with reasonable notice.

### 3. Your account
You are responsible for maintaining the security of your account and all activity under it. Notify us immediately of any unauthorized access at **security@seal.co**.

### 4. Acceptable use
You may not use Seal to: send fraudulent documents, violate applicable law, harass others, or attempt to circumvent our security controls.

### 5. Document content
You retain full ownership of your documents. You grant Seal a limited license to process your documents solely to operate the service.

### 6. Payment
Paid plans are billed monthly or annually. Refunds are handled on a case-by-case basis — contact **billing@seal.co**.

### 7. Limitation of liability
Seal is provided "as is." We are not liable for indirect, incidental, or consequential damages. Our total liability is limited to fees paid in the 12 months preceding a claim.

### 8. Governing law
These terms are governed by the laws of the State of Delaware.

**Contact:** legal@seal.co
`;

const SECURITY_CONTENT = `
## Security & Compliance

### Legal framework
Seal is compliant with the **Electronic Signatures in Global and National Commerce Act (ESIGN Act)** and the **Uniform Electronic Transactions Act (UETA)**, ensuring documents signed through Seal carry full legal enforceability in the United States.

### Audit trail
Every document event is recorded with:
- **Timestamp** (UTC, millisecond precision)
- **Signer identity** (email, name, and verification method)
- **IP address** and geolocation
- **Device fingerprint** (browser, OS, user agent)
- **Action type** (viewed, signed, declined, completed)

### Tamper evidence
Upon completion, each document is hashed using **SHA-256** and the hash is embedded in the audit certificate. Any modification to the document after signing will invalidate the certificate.

### Encryption
- **In transit:** TLS 1.2+ on all connections
- **At rest:** AES-256 encryption for all stored documents and data
- **Keys:** Managed via AWS KMS with key rotation

### Infrastructure
- Hosted on **AWS** (us-east-1 primary, multi-AZ)
- Automated daily backups with 30-day retention
- SOC 2 Type II audit in progress

### Access controls
- Role-based access control (RBAC) within organizations
- All internal Seal employee access is logged and audited
- Document content is accessible only to authorized signers and the sending organization

### Incident response
Security incidents are triaged within 24 hours. Affected customers are notified within 72 hours in accordance with GDPR obligations where applicable.

**Report a vulnerability:** security@seal.co
`;

function LegalModal({
  trigger,
  title,
  content,
}: {
  trigger: React.ReactNode;
  title: string;
  content: string;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="prose prose-sm dark:prose-invert mt-2 max-w-none">
          {content
            .trim()
            .split("\n")
            .map((line, i) => {
              if (line.startsWith("## "))
                return (
                  <h2 key={i} className="text-foreground mt-0 mb-4 font-serif text-xl">
                    {line.slice(3)}
                  </h2>
                );
              if (line.startsWith("### "))
                return (
                  <h3 key={i} className="text-foreground mt-6 mb-2 text-base font-medium">
                    {line.slice(4)}
                  </h3>
                );
              if (line.startsWith("- "))
                return (
                  <li key={i} className="text-muted-foreground ml-4 list-disc text-sm">
                    {parseInline(line.slice(2), i)}
                  </li>
                );
              if (line === "") return <div key={i} className="h-2" />;
              return (
                <p key={i} className="text-muted-foreground text-sm leading-relaxed">
                  {parseInline(line, i)}
                </p>
              );
            })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function parseInline(text: string, lineIndex: number): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={`${lineIndex}-${i}`} className="text-foreground font-medium">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    ),
  );
}

/* ── Footer ──────────────────────────────────────────────────────────────── */
const companyLinks = [
  { label: "Pricing", to: "/pricing" },
  { label: "Changelog", to: "/changelog" },
  { label: "Status", href: "https://status.seal.co" },
];

function FooterNavLink({ label, to, href }: { label: string; to?: string; href?: string }) {
  if (href) {
    return (
      <a
        className="text-muted-foreground hover:text-foreground text-sm transition-colors"
        href={href}
        target="_blank"
        rel="noreferrer"
      >
        {label}
      </a>
    );
  }
  return (
    <a className="text-muted-foreground hover:text-foreground text-sm transition-colors" href={to}>
      {label}
    </a>
  );
}

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-border border-t px-6 py-16" data-testid="site-footer">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-12 sm:grid-cols-2 md:grid-cols-3" data-testid="site-footer-inner">
          {/* Brand */}
          <div data-testid="site-footer-brand">
            <a href="/" className="mb-4 flex items-center gap-1.5">
              <svg
                aria-hidden="true"
                fill="none"
                height={36}
                viewBox="0 0 120 120"
                width={36}
                xmlns="http://www.w3.org/2000/svg"
              >
                <g transform="translate(18, 15) scale(0.95)">
                  <path
                    d="M88.648,6.374c0.001-0.055-0.013-0.108-0.022-0.163c-0.011-0.07-0.021-0.138-0.048-0.204c-0.006-0.014-0.004-0.029-0.01-0.043C88.551,5.927,88.52,5.903,88.5,5.869c-0.037-0.061-0.073-0.119-0.124-0.17c-0.047-0.048-0.1-0.082-0.155-0.119c-0.035-0.023-0.06-0.057-0.099-0.076c-0.014-0.007-0.03-0.005-0.045-0.012c-0.067-0.029-0.137-0.042-0.21-0.055c-0.051-0.009-0.1-0.024-0.15-0.025c-0.063-0.001-0.123,0.014-0.186,0.025c-0.063,0.011-0.124,0.02-0.183,0.044c-0.015,0.006-0.031,0.004-0.047,0.011c-0.056,0.024-5.57,2.547-7.997,3.334c-22.236,7.188-30.275,14.612-33.171,18.833c-0.095-0.22-0.273-0.402-0.501-0.501c-0.331-0.138-0.716-0.084-0.99,0.146c-4.199,3.507-6.103,9.171-6.938,12.867l-0.79-2.153c-0.112-0.301-0.366-0.527-0.68-0.6c-0.314-0.078-0.639,0.015-0.875,0.234c-1.966,1.852-8.369,13.68-10.522,17.71l-1.207-1.291c-0.348-0.377-0.936-0.407-1.321-0.075c-0.224,0.193-5.462,4.77-5.424,11.972c0.036,6.717-0.428,12.574-0.432,12.632c0,0.001,0,0.002,0,0.003c-0.01,0.126,0.004,0.253,0.044,0.374c0.018,0.054,0.055,0.097,0.082,0.146c-3.129,4.488-6.352,9.261-9.679,14.39c-0.286,0.445-0.161,1.037,0.282,1.325c0.161,0.103,0.342,0.153,0.521,0.153c0.312,0,0.62-0.153,0.803-0.435c3.72-5.735,7.323-11.05,10.802-15.986c2.853-1.439,7.119-1.248,10.079-1.111c1.166,0.056,2.085,0.101,2.751,0.039c0.534-0.049,1.532-0.136,1.723-1.016c0.153-0.702-0.34-1.13-0.94-1.5c0.11,0.015,0.217,0.028,0.318,0.041c1.857,0.245,3.136,0.377,3.954,0.071c0.762-0.29,0.826-0.901,0.828-1.08c0.009-0.968-0.96-1.357-3.085-2.205c-0.262-0.105-0.585-0.235-0.923-0.374c0.392,0.007,0.792,0.021,1.166,0.032c3.111,0.095,6.988,0.215,9.111-0.723c0.45-0.198,1.65-0.729,1.626-1.796c-0.028-1.125-1.31-1.618-2.667-2.139c-0.241-0.093-0.557-0.215-0.845-0.338c0.617-0.278,1.495-0.628,2.356-0.972c4.754-1.893,13.605-5.417,20.035-12.174c2.893-3.038,3.763-4.677,3.107-5.845c-0.783-1.398-3.074-0.904-5.727-0.329c-0.499,0.107-1.151,0.249-1.756,0.355c0.63-0.207,1.358-0.413,1.979-0.589c3.285-0.929,7.784-2.201,9.674-5.254c2.964-4.785,6.675-10.505,6.71-10.561c0.2-0.306,0.207-0.701,0.019-1.015c-0.189-0.314-0.555-0.488-0.904-0.46c-0.82,0.073-1.676,0.142-2.472,0.204c2.08-1.317,4.559-3.01,5.594-4.344c0.929-1.196,1.809-3.737,3.027-7.257c1.181-3.414,2.651-7.665,4.511-11.445c0.007-0.015,0.006-0.03,0.012-0.045c0.027-0.062,0.038-0.127,0.051-0.194C88.632,6.486,88.648,6.431,88.648,6.374zM82.237,17.604c-1.071,3.093-1.996,5.763-2.728,6.708c-1.172,1.51-5.251,4.002-6.99,5.066c-1.274,0.779-1.351,0.826-1.495,1.103c-0.164,0.31-0.148,0.695,0.047,0.988c0.336,0.506,0.406,0.622,5.047,0.232c-1.327,2.061-3.668,5.72-5.671,8.954c-1.501,2.422-5.585,3.576-8.569,4.421c-2.446,0.691-4.062,1.149-4.612,2.179c-0.204,0.385-0.241,0.809-0.105,1.226c0.519,1.601,2.683,1.13,5.421,0.538c1.101-0.235,2.863-0.604,3.562-0.532c-0.142,0.383-0.682,1.364-2.734,3.518c-6.14,6.454-14.737,9.877-19.357,11.716c-3.223,1.284-4.311,1.717-4.171,2.842c0.131,1.048,1.312,1.504,2.679,2.029c0.277,0.106,0.656,0.252,0.972,0.394c-0.006,0.002-0.011,0.004-0.017,0.007c-1.725,0.761-5.51,0.643-8.28,0.561c-3.427-0.108-4.43-0.099-4.89,0.699c-0.177,0.305-0.153,0.867,0.032,1.166c0.368,0.598,1.224,1.069,2.551,1.635c-1.721-0.219-2.715-0.278-3.24,0.396c-0.262,0.334-0.316,0.768-0.149,1.185c0.146,0.37,0.419,0.678,0.749,0.949c-0.256-0.011-0.529-0.024-0.809-0.037c-2.357-0.11-5.469-0.255-8.27,0.357c31.813-44.445,52.595-56.176,52.827-56.302c0.463-0.254,0.635-0.835,0.381-1.299c-0.252-0.46-0.828-0.637-1.297-0.383c-0.973,0.53-21.969,12.335-54.607,58.446c0.135-2.361,0.304-6.217,0.282-10.409c-0.026-4.86,2.797-8.455,4.105-9.86l1.45,1.551c0.209,0.226,0.516,0.334,0.824,0.297c0.308-0.041,0.576-0.228,0.721-0.503c2.964-5.602,7.551-13.896,9.806-17.167l1.446,3.935c0.155,0.419,0.564,0.673,1.026,0.618c0.443-0.06,0.787-0.418,0.826-0.865c0.007-0.094,0.807-8.567,5.434-13.794l0.075,1.155c0.032,0.488,0.426,0.865,0.914,0.888c0.548-0.023,0.916-0.336,0.988-0.819c0.017-0.105,1.97-10.563,33.479-20.749c1.506-0.487,4.031-1.561,5.886-2.377C84.368,11.49,83.202,14.817,82.237,17.604z"
                    fill="var(--primary)"
                  />
                </g>
              </svg>
              <span className="text-foreground font-serif text-[28px] leading-none tracking-tight italic">
                Seal
              </span>
            </a>
            <p className="text-muted-foreground text-sm leading-relaxed">
              The old tools offer e-signature.
              <br />
              We built an engine.
            </p>
          </div>

          {/* Company */}
          <div>
            <p className="text-foreground mb-4 text-xs font-semibold tracking-[0.12em] uppercase">
              Company
            </p>
            <ul className="space-y-3">
              {companyLinks.map((link) => (
                <li key={link.label}>
                  <FooterNavLink {...link} />
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <p className="text-foreground mb-4 text-xs font-semibold tracking-[0.12em] uppercase">
              Legal
            </p>
            <ul className="space-y-3">
              <li>
                <LegalModal
                  title="Privacy Policy"
                  content={PRIVACY_CONTENT}
                  trigger={
                    <button className="text-muted-foreground hover:text-foreground text-left text-sm transition-colors">
                      Privacy
                    </button>
                  }
                />
              </li>
              <li>
                <LegalModal
                  title="Terms of Service"
                  content={TERMS_CONTENT}
                  trigger={
                    <button className="text-muted-foreground hover:text-foreground text-left text-sm transition-colors">
                      Terms
                    </button>
                  }
                />
              </li>
              <li>
                <LegalModal
                  title="Security & Compliance"
                  content={SECURITY_CONTENT}
                  trigger={
                    <button className="text-muted-foreground hover:text-foreground text-left text-sm transition-colors">
                      Security
                    </button>
                  }
                />
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-border mx-auto mt-12 mb-8 w-16 border-t" />
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <span className="text-muted-foreground text-sm">
            © {currentYear} Seal. All rights reserved.
          </span>
          <a
            className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            href="https://status.seal.co"
            target="_blank"
            rel="noreferrer"
          >
            Status
          </a>
        </div>
      </div>
    </footer>
  );
}
