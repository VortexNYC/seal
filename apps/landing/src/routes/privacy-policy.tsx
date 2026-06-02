import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "~/components/ui/button";

export const Route = createFileRoute("/privacy-policy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy - Seal" },
      {
        name: "description",
        content:
          "Privacy Policy for Seal. Learn how we collect, use, and protect your data on our document signing platform.",
      },
    ],
  }),
  component: PrivacyPolicy,
});

function PrivacyPolicy() {
  return (
    <div className="bg-background py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-6">
        <div className="mb-12">
          <Button asChild size="sm" variant="ghost">
            <Link to="/">
              <ArrowLeft className="mr-1.5 size-3.5" />
              Back to Home
            </Link>
          </Button>
        </div>

        <article className="prose prose-sm md:prose-base prose-neutral dark:prose-invert max-w-none">
          <h1>Privacy Policy</h1>
          <p className="lead">Last updated: February 24, 2026</p>

          <p>
            Seal (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) is committed to protecting
            your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard
            your information when you use our document signing platform (&quot;Service&quot;).
          </p>

          <h2>1. Information We Collect</h2>

          <h3>Account Information</h3>
          <p>
            When you join the waitlist or sign up through an invitation, we collect information
            provided through our authentication provider, Clerk, including your name, email address,
            and profile image.
          </p>

          <h3>Document Data</h3>
          <p>
            When you use the Service, we store the documents you upload, signature images, form
            field data, and recipient information (names and email addresses) that you provide.
          </p>

          <h3>Signing Activity</h3>
          <p>For each document signing event, we collect audit trail data including:</p>
          <ul>
            <li>Timestamps of document views, signatures, and other actions</li>
            <li>IP addresses of signers</li>
            <li>ESIGN Act consent records</li>
            <li>Signature hashes (SHA-256) for integrity verification</li>
          </ul>

          <h3>Payment Information</h3>
          <p>
            Payment processing is handled by Stripe. We do not store your full credit card number or
            banking details. Stripe may collect payment information directly in accordance with
            their privacy policy.
          </p>

          <h3>Usage Data</h3>
          <p>
            We automatically collect information about how you interact with the Service, including
            pages visited, features used, browser type, device information, and referring URLs.
          </p>

          <h2>2. How We Use Your Information</h2>
          <p>We use the information we collect to:</p>
          <ul>
            <li>Provide, maintain, and improve the Service</li>
            <li>Process and deliver documents for signing</li>
            <li>
              Send transactional emails (document invitations, reminders, completion notifications)
            </li>
            <li>Process payments and manage subscriptions</li>
            <li>Maintain audit trails for legal compliance</li>
            <li>Detect and prevent fraud or abuse</li>
            <li>Respond to support requests</li>
            <li>Analyze usage to improve the Service</li>
          </ul>

          <h2>3. Third-Party Services</h2>
          <p>
            We use the following third-party services to operate the platform. Each processes data
            in accordance with their own privacy policies:
          </p>
          <ul>
            <li>
              <strong>Clerk</strong> — Authentication and identity management
            </li>
            <li>
              <strong>Convex</strong> — Backend infrastructure and data storage
            </li>
            <li>
              <strong>Stripe</strong> — Payment processing and subscription management
            </li>
            <li>
              <strong>Resend</strong> — Transactional email delivery
            </li>
            <li>
              <strong>Vercel</strong> — Application hosting and deployment
            </li>
          </ul>
          <p>We do not sell your personal information to third parties.</p>

          <h2>4. Data Retention</h2>
          <p>
            We retain your data for as long as your account is active or as needed to provide the
            Service. Specifically:
          </p>
          <ul>
            <li>
              <strong>Account data</strong> — Retained until you request deletion
            </li>
            <li>
              <strong>Documents and signatures</strong> — Retained for the duration of your account
              plus a reasonable period to fulfill legal and compliance obligations
            </li>
            <li>
              <strong>Audit trails</strong> — Retained for a minimum of 7 years to support the legal
              enforceability of signed documents
            </li>
            <li>
              <strong>Usage data</strong> — Retained in anonymized form for analytics purposes
            </li>
          </ul>
          <p>
            Upon account deletion, we will remove your personal data within 30 days, except where
            retention is required by law or necessary to maintain the integrity of signed documents.
          </p>

          <h2>5. Data Security</h2>
          <p>
            We implement appropriate technical and organizational measures to protect your data,
            including:
          </p>
          <ul>
            <li>Encryption of data in transit (TLS) and at rest</li>
            <li>SHA-256 hashing for signature verification and token security</li>
            <li>Role-based access control within workspaces</li>
            <li>Comprehensive audit logging of all document actions</li>
            <li>Rate limiting on API endpoints to prevent abuse</li>
            <li>Regular security reviews of our infrastructure</li>
          </ul>
          <p>
            While we strive to protect your data, no method of electronic transmission or storage is
            100% secure. We cannot guarantee absolute security.
          </p>

          <h2>6. Your Rights</h2>
          <p>Depending on your jurisdiction, you may have the right to:</p>
          <ul>
            <li>
              <strong>Access</strong> — Request a copy of the personal data we hold about you
            </li>
            <li>
              <strong>Correction</strong> — Request correction of inaccurate personal data
            </li>
            <li>
              <strong>Deletion</strong> — Request deletion of your personal data, subject to legal
              retention requirements
            </li>
            <li>
              <strong>Portability</strong> — Request a machine-readable copy of your data
            </li>
            <li>
              <strong>Objection</strong> — Object to certain processing of your personal data
            </li>
          </ul>
          <p>
            To exercise these rights, contact us at{" "}
            <a href="mailto:privacy@seal.co">privacy@seal.co</a>. We will respond within 30 days.
          </p>

          <h2>7. Cookies &amp; Tracking</h2>
          <p>
            We use essential cookies to maintain your session and authentication state. We do not
            use third-party advertising cookies or cross-site tracking.
          </p>
          <p>
            We may use analytics services to understand how the Service is used. These services
            collect anonymized usage data and do not track you across other websites.
          </p>

          <h2>8. Children&apos;s Privacy</h2>
          <p>
            The Service is not intended for children under 18. We do not knowingly collect personal
            information from children. If we discover that a child under 18 has provided personal
            information, we will promptly delete it.
          </p>

          <h2>9. International Data Transfers</h2>
          <p>
            Your data may be processed and stored in the United States. By using the Service, you
            consent to the transfer of your data to the United States, where data protection laws
            may differ from those in your jurisdiction.
          </p>

          <h2>10. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of material
            changes by posting the updated policy on this page and updating the &quot;Last
            updated&quot; date. Your continued use of the Service after changes are posted
            constitutes acceptance of the revised policy.
          </p>

          <h2>11. Contact</h2>
          <p>
            If you have questions about this Privacy Policy or our data practices, contact us at:
          </p>
          <ul>
            <li>
              Email: <a href="mailto:privacy@seal.co">privacy@seal.co</a>
            </li>
            <li>
              General support: <a href="mailto:support@seal.co">support@seal.co</a>
            </li>
          </ul>
          <p>
            For information about our Terms of Service, see our{" "}
            <Link className="underline" to="/terms-of-service">
              Terms of Service
            </Link>
            .
          </p>
        </article>
      </div>
    </div>
  );
}
