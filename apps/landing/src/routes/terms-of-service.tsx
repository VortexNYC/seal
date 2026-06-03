import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "~/components/ui/button";

export const Route = createFileRoute("/terms-of-service")({
  head: () => ({
    meta: [
      { title: "Terms of Service - Seal" },
      {
        name: "description",
        content:
          "Terms of Service for Seal, the intelligent document signing platform. Read about usage terms, ESIGN compliance, and your rights.",
      },
    ],
  }),
  component: TermsOfService,
});

function TermsOfService() {
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
          <h1>Terms of Service</h1>
          <p className="lead">Last updated: February 24, 2026</p>

          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using Seal (&quot;Service&quot;), operated by Seal (&quot;we,&quot;
            &quot;us,&quot; or &quot;our&quot;), you agree to be bound by these Terms of Service
            (&quot;Terms&quot;). If you do not agree to these Terms, you may not use the Service.
          </p>
          <p>
            These Terms apply to all users of the Service, including document senders, recipients,
            signers, and API consumers.
          </p>

          <h2>2. Eligibility</h2>
          <p>
            You must be at least 18 years old and have the legal capacity to enter into binding
            agreements to use the Service. By using Seal, you represent that you meet these
            requirements.
          </p>

          <h2>3. Account Registration &amp; Security</h2>
          <p>
            To use certain features of the Service, you may need an account or an approved
            invitation. You agree to:
          </p>
          <ul>
            <li>Provide accurate, current, and complete information during registration</li>
            <li>Maintain the security of your account credentials</li>
            <li>Promptly notify us of any unauthorized use of your account</li>
            <li>Accept responsibility for all activity that occurs under your account</li>
          </ul>
          <p>
            Authentication is managed by Seal on our own infrastructure.
          </p>

          <h2>4. Service Description</h2>
          <p>Seal is an intelligent document platform that provides:</p>
          <ul>
            <li>
              <strong>Document signing</strong> — Create, send, and collect legally binding
              electronic signatures on documents
            </li>
            <li>
              <strong>Payment collection</strong> — Collect payments from document recipients
              through integrated Stripe payment processing
            </li>
            <li>
              <strong>REST API</strong> — Programmatic access to create documents, manage
              recipients, and receive webhook notifications
            </li>
            <li>
              <strong>AI-powered features</strong> — Automated field detection and document
              intelligence
            </li>
            <li>
              <strong>Workspace management</strong> — Organization-based access control with
              role-based permissions
            </li>
          </ul>

          <h2>5. Electronic Signatures &amp; Legal Compliance</h2>
          <p>Seal facilitates electronic signatures in compliance with:</p>
          <ul>
            <li>
              The <strong>Electronic Signatures in Global and National Commerce Act</strong> (ESIGN
              Act, 15 U.S.C. &sect; 7001 et seq.)
            </li>
            <li>
              The <strong>Uniform Electronic Transactions Act</strong> (UETA) as adopted by
              applicable states
            </li>
          </ul>
          <p>
            Electronic signatures executed through Seal are intended to be legally binding. However,
            Seal does not provide legal advice. You are responsible for ensuring that electronic
            signatures are appropriate and legally sufficient for your specific use case and
            jurisdiction.
          </p>
          <p>
            We maintain audit trails for all document signing activity, including timestamps, IP
            addresses, and consent records, to support the enforceability of documents signed
            through the Service.
          </p>

          <h2>6. Acceptable Use</h2>
          <p>You agree not to use the Service to:</p>
          <ul>
            <li>Violate any applicable laws or regulations</li>
            <li>Send fraudulent documents or misrepresent the contents of documents</li>
            <li>Collect signatures through deception or coercion</li>
            <li>Upload malicious files or content</li>
            <li>Attempt to gain unauthorized access to other accounts or systems</li>
            <li>Interfere with or disrupt the Service or its infrastructure</li>
            <li>Use the API in a manner that exceeds rate limits or degrades service for others</li>
            <li>Reverse-engineer, decompile, or disassemble any part of the Service</li>
          </ul>

          <h2>7. Payment Terms</h2>
          <p>Seal offers multiple subscription tiers:</p>
          <ul>
            <li>
              <strong>Free</strong> — Limited document sends per month at no cost
            </li>
            <li>
              <strong>Pro</strong> — Expanded limits, workspace features, and priority support for a
              monthly or annual subscription fee
            </li>
            <li>
              <strong>Enterprise</strong> — Custom pricing with dedicated support and advanced
              features
            </li>
          </ul>
          <p>
            Payments are processed through Stripe. By subscribing to a paid plan, you authorize
            recurring charges to your payment method. You may cancel your subscription at any time;
            cancellation takes effect at the end of the current billing period.
          </p>
          <p>
            We reserve the right to modify pricing with 30 days&apos; notice. Price changes do not
            apply to the current billing period.
          </p>

          <h2>8. Intellectual Property</h2>
          <p>
            The Service, including its design, code, features, and documentation, is owned by Seal
            and protected by intellectual property laws. You retain ownership of all documents,
            content, and data you upload to the Service.
          </p>
          <p>
            By uploading content to Seal, you grant us a limited license to store, process, and
            display your content solely for the purpose of providing the Service. We do not claim
            ownership of your content and will not use it for any other purpose.
          </p>

          <h2>9. Data &amp; Privacy</h2>
          <p>
            Your use of the Service is also governed by our{" "}
            <Link className="underline" to="/privacy-policy">
              Privacy Policy
            </Link>
            , which describes how we collect, use, and protect your information.
          </p>

          <h2>10. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, Seal shall not be liable for any indirect,
            incidental, special, consequential, or punitive damages, including but not limited to
            loss of profits, data, or business opportunities, arising from your use of or inability
            to use the Service.
          </p>
          <p>
            Our total liability for any claim arising from or related to the Service shall not
            exceed the amount you paid us in the twelve (12) months preceding the claim.
          </p>

          <h2>11. Disclaimer of Warranties</h2>
          <p>
            The Service is provided &quot;as is&quot; and &quot;as available&quot; without
            warranties of any kind, whether express or implied, including but not limited to implied
            warranties of merchantability, fitness for a particular purpose, and non-infringement.
          </p>
          <p>
            We do not warrant that the Service will be uninterrupted, error-free, or secure, or that
            any defects will be corrected.
          </p>

          <h2>12. Termination</h2>
          <p>
            We may suspend or terminate your access to the Service at any time for violation of
            these Terms, with or without notice. You may terminate your account at any time by
            contacting us.
          </p>
          <p>
            Upon termination, your right to use the Service ceases immediately. We will retain your
            data for a reasonable period to comply with legal obligations, after which it will be
            deleted in accordance with our Privacy Policy.
          </p>

          <h2>13. Changes to Terms</h2>
          <p>
            We may update these Terms from time to time. We will notify you of material changes by
            posting the updated Terms on this page and updating the &quot;Last updated&quot; date.
            Your continued use of the Service after changes are posted constitutes acceptance of the
            revised Terms.
          </p>

          <h2>14. Governing Law</h2>
          <p>
            These Terms are governed by and construed in accordance with the laws of the State of
            Delaware, United States, without regard to its conflict of law principles.
          </p>

          <h2>15. Contact</h2>
          <p>
            If you have questions about these Terms, contact us at{" "}
            <a href="mailto:legal@seal.co">legal@seal.co</a>.
          </p>
        </article>
      </div>
    </div>
  );
}
