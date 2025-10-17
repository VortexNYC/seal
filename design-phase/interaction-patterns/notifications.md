# Email Design Patterns - React Email Components + shadcn Neutral

**Using actual React Email components with shadcn neutral palette and Tailwind classes for beautiful email templates.**

## React Email Component Structure

### Available Components We'll Use
- `Html` - Root wrapper with lang/dir
- `Head` - Email head with meta tags
- `Preview` - Email preview text
- `Body` - Email body wrapper  
- `Container` - Content container (600px max width)
- `Section` - Layout sections
- `Row` - Horizontal layout
- `Column` - Column layout
- `Text` - Typography component
- `Heading` - Heading typography
- `Button` - CTA buttons
- `Link` - Text links
- `Hr` - Horizontal dividers
- `Image` - Images with fallbacks
- `Tailwind` - Tailwind CSS integration

## Email Template Visual Patterns

### Base Email Structure Pattern
```jsx
import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Text,
  Button,
  Tailwind,
} from "@react-email/components";

const EmailTemplate = () => {
  return (
    <Html lang="en">
      <Head />
      <Preview>Email preview text here</Preview>
      <Tailwind>
        <Body className="bg-white font-sans">
          <Container className="max-w-[600px] mx-auto py-8 px-8">
            {/* Header */}
            <Section>
              <Text className="text-2xl font-bold text-neutral-900 mb-0">
                Seal
              </Text>
            </Section>
            
            {/* Content sections */}
            
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};
```

## Signature Request Email Design

### Visual Structure with React Email Components
```jsx
const SignatureRequestEmail = ({ senderName, documentTitle, documentUrl }) => {
  return (
    <Html lang="en">
      <Head />
      <Preview>{senderName} has requested your signature on {documentTitle}</Preview>
      <Tailwind>
        <Body className="bg-white font-sans">
          <Container className="max-w-[600px] mx-auto py-8 px-8">
            
            {/* Header */}
            <Section className="border-b border-neutral-200 pb-6 mb-8">
              <Text className="text-2xl font-bold text-neutral-900 mb-0">Seal</Text>
            </Section>

            {/* Main Content */}
            <Section>
              <Heading className="text-xl text-neutral-900 mb-4">
                {senderName} has requested your signature
              </Heading>
              
              <Text className="text-base text-neutral-600 leading-relaxed mb-6">
                Please review and sign the document below. This should only take a few minutes.
              </Text>

              {/* Document Card */}
              <Section className="bg-neutral-50 border border-neutral-200 rounded-lg p-6 mb-8">
                <Row>
                  <Column>
                    <Text className="text-2xl mb-2">=Ä</Text>
                    <Heading className="text-lg text-neutral-900 mb-1">
                      {documentTitle}
                    </Heading>
                    <Text className="text-sm text-neutral-500 mb-0">
                      Due: March 15, 2024 " 2 pages
                    </Text>
                  </Column>
                </Row>
              </Section>

              {/* Primary CTA */}
              <Section className="text-center mb-6">
                <Button
                  href={documentUrl}
                  className="bg-neutral-900 text-white px-8 py-3 rounded-md font-medium inline-block no-underline"
                >
                  Review & Sign Document
                </Button>
              </Section>

              {/* Secondary Action */}
              <Section className="text-center">
                <Link
                  href={`${documentUrl}?view=details`}
                  className="text-neutral-500 text-sm underline"
                >
                  View details only
                </Link>
              </Section>
            </Section>

            {/* Footer */}
            <Hr className="border-neutral-200 my-8" />
            
            <Section>
              <Text className="text-sm text-neutral-500 text-center mb-2">
                Questions? Reply to this email or visit our Help Center.
              </Text>
              <Text className="text-xs text-neutral-400 text-center mb-0">
                Seal " San Francisco, CA
              </Text>
            </Section>

          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};
```

## Welcome Email Design

### React Email Component Structure
```jsx
const WelcomeEmail = ({ userName, verifyUrl }) => {
  return (
    <Html lang="en">
      <Head />
      <Preview>Welcome to Seal - Let's get you started!</Preview>
      <Tailwind>
        <Body className="bg-white font-sans">
          <Container className="max-w-[600px] mx-auto py-8 px-8">
            
            {/* Header */}
            <Section className="border-b border-neutral-200 pb-6 mb-8">
              <Text className="text-2xl font-bold text-neutral-900 mb-0">Seal</Text>
            </Section>

            {/* Welcome Content */}
            <Section className="text-center mb-8">
              <Heading className="text-3xl text-neutral-900 mb-4">
                Welcome to Seal! =K
              </Heading>
              
              <Text className="text-lg text-neutral-600 leading-relaxed mb-8">
                We're excited to have you on board. Here's everything you need 
                to get started with digital document signing.
              </Text>

              {/* Primary CTA */}
              <Button
                href={verifyUrl}
                className="bg-neutral-900 text-white px-8 py-4 rounded-md font-medium inline-block no-underline text-base"
              >
                Verify Email Address
              </Button>
            </Section>

            {/* Next Steps */}
            <Section className="bg-neutral-50 rounded-lg p-6 mb-8">
              <Heading className="text-lg text-neutral-700 mb-4">Next steps:</Heading>
              
              <Text className="text-base text-neutral-600 leading-relaxed mb-2">
                " Upload your first document
              </Text>
              <Text className="text-base text-neutral-600 leading-relaxed mb-2">
                " Set up signature preferences  
              </Text>
              <Text className="text-base text-neutral-600 leading-relaxed mb-0">
                " Explore document templates
              </Text>
            </Section>

            {/* Footer */}
            <Hr className="border-neutral-200 my-8" />
            
            <Section>
              <Text className="text-sm text-neutral-500 text-center mb-2">
                Need help? Reply to this email or visit our Help Center.
              </Text>
              <Text className="text-xs text-neutral-400 text-center mb-0">
                Seal " San Francisco, CA
              </Text>
            </Section>

          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};
```

## Email Verification Design

### Minimal Focus Layout with React Email
```jsx
const EmailVerificationEmail = ({ verifyUrl, verificationCode }) => {
  return (
    <Html lang="en">
      <Head />
      <Preview>Please verify your email address</Preview>
      <Tailwind>
        <Body className="bg-white font-sans">
          <Container className="max-w-[600px] mx-auto py-8 px-8">
            
            {/* Header */}
            <Section className="border-b border-neutral-200 pb-6 mb-8">
              <Text className="text-2xl font-bold text-neutral-900 mb-0">Seal</Text>
            </Section>

            {/* Verification Content */}
            <Section className="text-center">
              <Heading className="text-2xl text-neutral-900 mb-6">
                Please verify your email address
              </Heading>
              
              <Text className="text-base text-neutral-600 leading-relaxed mb-8">
                Click the button below to verify your account and start using Seal.
              </Text>

              {/* Verification Button */}
              <Section className="mb-8">
                <Button
                  href={verifyUrl}
                  className="bg-neutral-900 text-white px-8 py-4 rounded-md font-medium inline-block no-underline text-base"
                >
                  Verify Email Address
                </Button>
              </Section>

              {/* Alternative Code */}
              <Text className="text-sm text-neutral-500 mb-4">
                Or use this verification code:
              </Text>
              
              <Section className="bg-neutral-100 border border-neutral-200 rounded-md py-4 px-6 mb-6">
                <Text className="font-mono text-lg text-neutral-800 tracking-widest mb-0">
                  {verificationCode}
                </Text>
              </Section>

              <Text className="text-xs text-neutral-400 mb-0">
                This link expires in 24 hours
              </Text>
            </Section>

            {/* Footer */}
            <Hr className="border-neutral-200 my-8" />
            
            <Section>
              <Text className="text-sm text-neutral-500 text-center mb-0">
                Seal " San Francisco, CA
              </Text>
            </Section>

          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};
```

## Document Completed Email Design

### Success-Focused Layout
```jsx
const DocumentCompletedEmail = ({ documentTitle, downloadUrl, certificateUrl }) => {
  return (
    <Html lang="en">
      <Head />
      <Preview>{documentTitle} has been fully executed</Preview>
      <Tailwind>
        <Body className="bg-white font-sans">
          <Container className="max-w-[600px] mx-auto py-8 px-8">
            
            {/* Header */}
            <Section className="border-b border-neutral-200 pb-6 mb-8">
              <Text className="text-2xl font-bold text-neutral-900 mb-0">Seal</Text>
            </Section>

            {/* Success Content */}
            <Section className="text-center mb-8">
              <Text className="text-4xl mb-4"></Text>
              
              <Heading className="text-2xl text-neutral-900 mb-4">
                Document Completed
              </Heading>
              
              <Text className="text-base text-neutral-600 leading-relaxed mb-8">
                {documentTitle} has been fully signed by all parties.
              </Text>
            </Section>

            {/* Document Summary Card */}
            <Section className="bg-neutral-50 border border-neutral-200 rounded-lg p-6 mb-8">
              <Row>
                <Column>
                  <Text className="text-2xl mb-2">=Ä</Text>
                  <Heading className="text-lg text-neutral-900 mb-1">
                    {documentTitle}
                  </Heading>
                  <Text className="text-sm text-neutral-500 mb-1">
                    Completed: March 15, 2024
                  </Text>
                  <Text className="text-sm text-green-600 font-medium mb-0">
                    3/3 signatures collected
                  </Text>
                </Column>
              </Row>
            </Section>

            {/* Download Actions */}
            <Section className="text-center mb-6">
              <Button
                href={downloadUrl}
                className="bg-neutral-900 text-white px-8 py-3 rounded-md font-medium inline-block no-underline mr-4 mb-4"
              >
                Download Signed Document
              </Button>
            </Section>

            <Section className="text-center mb-8">
              <Link
                href={certificateUrl}
                className="text-neutral-500 text-sm underline"
              >
                View completion certificate
              </Link>
            </Section>

            {/* Footer */}
            <Hr className="border-neutral-200 my-8" />
            
            <Section>
              <Text className="text-sm text-neutral-500 text-center mb-2">
                Document safely stored in your Seal library.
              </Text>
              <Text className="text-xs text-neutral-400 text-center mb-0">
                Seal " San Francisco, CA
              </Text>
            </Section>

          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};
```

## Tailwind Classes for Email Design

### Typography Classes
```css
/* Headings */
.text-3xl  /* 30px - Main headings */
.text-2xl  /* 24px - Section headings */
.text-xl   /* 20px - Subsection headings */
.text-lg   /* 18px - Large text */
.text-base /* 16px - Body text */
.text-sm   /* 14px - Small text */
.text-xs   /* 12px - Caption text */

/* Font weights */
.font-bold   /* 700 - Headlines */
.font-medium /* 500 - Button text, labels */
.font-normal /* 400 - Body text */

/* Colors with neutral palette */
.text-neutral-900  /* Primary text */
.text-neutral-600  /* Body text */
.text-neutral-500  /* Secondary text */
.text-neutral-400  /* Muted text */
```

### Layout Classes
```css
/* Backgrounds */
.bg-white         /* Email background */
.bg-neutral-50    /* Card backgrounds */
.bg-neutral-100   /* Input/code backgrounds */
.bg-neutral-900   /* Button backgrounds */

/* Borders */
.border-neutral-200  /* Subtle borders */
.border-b           /* Bottom border only */
.rounded-md         /* 6px border radius */
.rounded-lg         /* 8px border radius */

/* Spacing */
.py-8  /* 32px top/bottom padding */
.px-8  /* 32px left/right padding */
.py-4  /* 16px top/bottom padding */
.px-6  /* 24px left/right padding */
.mb-8  /* 32px bottom margin */
.mb-6  /* 24px bottom margin */
.mb-4  /* 16px bottom margin */
```

## Email Client Compatibility Notes

### React Email + Tailwind Considerations
- **Inline styles generated** - React Email converts Tailwind classes to inline styles for email client compatibility
- **Outlook compatibility** - Component structure designed for Outlook's table-based rendering
- **Mobile responsive** - Container max-width and padding ensure mobile readability
- **Dark mode** - Neutral colors provide good contrast in both light and dark email clients

### Component Best Practices
- Use `Container` for 600px max-width content areas
- Use `Section` for major layout blocks
- Use `Row`/`Column` for complex layouts
- Use semantic HTML through React Email components
- Keep Tailwind classes simple and email-client friendly

This approach leverages React Email's actual component library while maintaining our shadcn neutral design aesthetic for beautiful, compatible email templates.