# Seal - Project Vision

## 🎯 Mission Statement

Build an open source, developer-first alternative to DocuSign that founders and builders love, eventually penetrating larger organizations through community adoption and superior developer experience.

## 🚀 Core Philosophy

- **Open Source First**: Transparency, community-driven development
- **Developer Experience**: Built by developers, for developers
- **Modern Stack**: Leverage the best open source tools and frameworks
- **Speed**: Move fast, iterate quickly, ship early and often

## 🏗️ Project Architecture

### Monorepo Structure

We're using a **Turborepo + Bun workspaces** monorepo for code organization and build optimization.

```
/seal (root)
├── /apps
│   ├── /web              # Main web application (Bun + React + TanStack Router)
│   └── /docs             # API documentation site
├── /packages
│   ├── /ui               # Shared UI components (shadcn/ui)
│   ├── /convex           # Convex backend schemas and functions
│   ├── /api              # Public REST API layer
│   └── /shared           # Shared utilities, types, Zod schemas
├── /tooling
│   ├── /biome            # Biome linter/formatter config
│   └── /typescript       # Shared TypeScript configuration
└── package.json          # Root workspace configuration
```

### Deployment Architecture

- **Frontend**: Vercel (web app only)
- **Backend**: Convex (completely independent deployment with own CLI)
- **Auth**: Clerk (hosted service)
- **Payments**: Stripe (hosted service)
- **Email**: Resend (hosted service)

## 🛠 Technology Stack

### Package Management & Build Tools

- **Bun**: Ultra-fast JavaScript runtime and package manager (all the way!)
- **Turborepo**: Monorepo build system with intelligent caching
- **Vite**: Lightning-fast build tooling and development server
- **TypeScript**: Type safety and superior developer experience

### Frontend & UI

- **React**: Component-based UI development
- **TanStack Router**: Type-safe routing for React applications
- **Tailwind CSS**: Utility-first CSS framework for rapid styling
- **shadcn/ui**: Beautiful, accessible UI components built on Radix
- **Expo**: Cross-platform mobile development (future phase)

### Backend & Infrastructure

- **Convex**: Real-time backend with TypeScript (independent deployment)
- **Clerk**: Production-ready authentication and organization management
- **Stripe**: Payment processing and subscription management
- **Resend**: Email delivery with React Email templates

### Deployment & Hosting

- **Vercel**: Frontend deployment only
- **Convex**: Backend deployment (completely separate, uses own CLI)

### Data & Validation

- **Zod**: TypeScript-first schema validation
- **TanStack Form**: Advanced form handling with validation
- **TanStack Query**: Client-side data synchronization (minimal caching, Convex handles real-time)
- **TanStack Virtual**: Virtualization for large documents

### Document Processing & Communication

- **react-pdf**: PDF rendering as images/canvas in browser for display
- **@react-pdf-viewer/core**: Rich PDF viewer UI (zoom, search, navigation, toolbar)
- **PDF-lib**: Low-level PDF manipulation (adding signature fields, flattening documents)
- **react-signature-canvas**: Canvas-based signature capture
- **React Email**: Component-based email templates
- **Note**: Not generating PDFs from scratch - users upload existing PDFs

### Interactive Canvas & Positioning

- **@dnd-kit/core**: Modern drag-and-drop with accessibility focus
- **konva.js + react-konva**: Canvas interactions and coordinate mathematics
- **fabric.js**: Advanced canvas library (backup option)

### Security & Utilities

- **Web Crypto API**: Browser-native cryptography for digital signatures and document hashing
- **date-fns**: Lightweight date handling library
- **sharp**: Image processing and optimization

### Observability

- **PostHog**: Product analytics and feature flags (post-MVP)

### Search & Content Processing

- **pdf-ts**: PDF text extraction for search functionality (built on PDF.js)
- **fuse.js**: Fuzzy search for document titles and extracted content
- **qrcode**: Generate QR codes for mobile signing links
- **tesseract.js**: Client-side OCR for scanned document text extraction

### API Management & Compliance

_Security & compliance features extracted to /feature-specs/authentication/26-security-compliance.md_

### Data Export & Reporting

- **exceljs**: Excel file generation and manipulation
- **export-to-csv**: JSON to CSV data export
- **react-pdf**: PDF report generation (leveraging existing setup)

### Developer Experience & Quality

- **Biome**: Fast linter and formatter (replaces ESLint & Prettier)
- **Vitest**: Unit testing framework (Bun compatible)
- **Playwright**: End-to-end testing
- **CI/CD**: To be determined (post-MVP setup)

### 🚫 Excluded from MVP (Future Consideration)

- **Document Conversion**: Office-to-PDF conversion (complex, external dependencies)
- **Advanced Analytics**: Custom dashboard builders (basic reporting sufficient)
- **Advanced Mobile Features**: Offline signing, GPS verification, biometric auth
- **Enterprise Admin**: Advanced user provisioning, legal holds, bulk operations
- **White-label Branding**: Complete customization, custom domains (basic branding included)
- **Advanced Workflow Automation**: Complex rule engines, conditional logic builders

## 🎯 Target Market

### Primary Targets (MVP Focus)

1. **Indie Founders**: Need simple, cost-effective document signing
2. **Developers/Agencies**: Want customizable, API-first solutions
3. **Small-Medium Businesses**: Seeking alternatives to expensive enterprise solutions

### Secondary Targets (Future)

1. **Enterprise Organizations**: Through bottom-up adoption
2. **White-label Partners**: Agencies and consultants

## 🏆 Competitive Landscape

### Main Competitors

1. **DocuSign** (51% market share)
   - Strengths: Brand recognition, enterprise features
   - Weaknesses: Expensive, complex, closed source

2. **PandaDoc**
   - Strengths: Sales-focused features, good UX
   - Weaknesses: Pricing, limited customization

3. **Dropbox Sign** (formerly HelloSign)
   - Strengths: Simple UX, Dropbox integration
   - Weaknesses: Limited advanced features

### Our Competitive Advantages

- **Open Source**: Transparency, community contributions, self-hosting options
- **Modern Stack**: Better performance, developer experience
- **API-First**: Easy integration and customization
- **Cost-Effective**: Leveraging open source economics
- **Community-Driven**: Built with and for the developer community

## 🎯 Value Propositions

### For Developers

- Open source codebase for transparency and contributions
- Modern, well-documented APIs
- TypeScript throughout the stack
- Easy self-hosting options
- Extensible architecture

### For Businesses

- Significant cost savings vs. enterprise alternatives
- No vendor lock-in
- Customizable to specific workflows
- Fast implementation and setup
- Community support and continuous improvement

## 🚀 Go-to-Market Strategy

### Phase 1: Community Building

- Launch as open source project
- Engage developer communities (Twitter, GitHub, Reddit)
- Create compelling documentation and examples
- Build initial user base through organic adoption

### Phase 2: Product-Led Growth

- Focus on exceptional user experience
- Implement viral features (easy sharing, referrals)
- Leverage community feedback for rapid iteration
- Build integrations with popular developer tools

### Phase 3: Enterprise Expansion

- Develop enterprise features based on community feedback
- Offer hosted solutions alongside open source
- Partner with agencies and consultants
- Scale through bottom-up adoption

## 🎪 Community Strategy

- **Slack Channel**: Once MVP stabilizes, create community hub
- **Open Source Contributions**: Welcome external contributors
- **Documentation**: Comprehensive guides and tutorials
- **Examples & Templates**: Pre-built solutions for common use cases

## 📈 Success Metrics

- GitHub stars and community engagement
- Active users and document signing volume
- Integration adoptions
- Community contributions
- Revenue growth (hosted solutions)

---

## 🎨 Brand Positioning Strategy ("The Stripe Effect")

### Visual Design Principles (Inspired by Stripe.com)

- **Minimalist Aesthetic**: Clean, uncluttered layouts with generous white space
- **Monochromatic Palette**: Primarily black and white with subtle accent colors
- **Subtle Gradients**: Light gradient backgrounds on components for depth
- **Clear Typography**: Developer-friendly fonts that feel technical yet approachable
- **Modular Layout**: Card-based design with consistent spacing and alignment
- **Nothing Cramped**: Every element has room to breathe

### Messaging Strategy

#### Primary Positioning

**"Document signing infrastructure for modern developers"**
_The open source alternative that developers actually want to use_

#### Our "Simple API Call" Equivalent

```bash
curl https://api.seal.io/v1/documents/send \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "document=@contract.pdf" \
  -F "recipients[0][email]=signer@example.com"
```

**"Send documents for signature with a simple API call"**

#### Key Value Propositions

1. **Developer Experience First**: API that just works, comprehensive docs, TypeScript native
2. **No Vendor Lock-in**: Open source, self-hostable, community-driven
3. **Modern Stack**: Built with the tools developers love (React, TypeScript, Convex)
4. **Fair Pricing**: Pay for what you use, no hidden fees, transparent costs
5. **Community Powered**: Shaped by real developer needs, not corporate interests

### Trust & Security Messaging

- **"Community-built, security-first"**: Emphasize collective development approach
- **"Own your data, always"**: Self-hosting options and data portability
- **"Legally compliant by design"**: Built with eSign Act and UETA compliance
- **"The community is fixing e-signatures"**: Position as developer movement

### Website Structure Strategy

#### Main Website Focus (Business Users)

- **Hero**: Simple value prop with beautiful signing demo
- **Features**: Focus on ease of use, not technical implementation
- **Use Cases**: Business scenarios, not code examples
- **Pricing**: Clear, simple tiers with transparent costs
- **Trust Signals**: Compliance, security, testimonials

#### Developer Section (Separate but Connected)

- **API Reference**: Comprehensive REST API documentation
- **Code Examples**: Real implementation snippets in multiple languages
- **Integrations**: Framework adapters and webhook examples
- **Interactive API Explorer**: Try endpoints with your API key
- **GitHub Integration**: Direct links to open source repos and example apps

### Competitive Differentiation Messages

#### vs DocuSign

- **"Finally, an e-signature solution built for 2025"**
- **"All the power, none of the vendor lock-in"**
- **"Professional features without enterprise pricing"**

#### vs PandaDoc

- **"Pure e-signatures, not bloated sales tools"**
- **"Developer-first, sales-team approved"**
- **"Focus on what matters: getting documents signed"**

#### vs Dropbox Sign

- **"Open source simplicity with enterprise features"**
- **"The reliability you need, the transparency you want"**
- **"Community-driven development, not corporate decisions"**

### Brand Personality

- **Transparent**: Open source, clear pricing, honest about limitations
- **Confident**: We know we're building something better
- **Community-focused**: Built with and for developers
- **Professional**: Enterprise-ready but not enterprise-complex
- **Modern**: Using today's best tools and practices

---

_This document serves as our north star as we build the future of open source document signing._
