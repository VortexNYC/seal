/**
 * SEO Configuration and Utilities
 *
 * This module provides centralized SEO configuration and helper functions
 * for generating meta tags, canonical URLs, and structured data.
 */

// Base site configuration
const siteConfig = {
	name: "Seal",
	tagline: "Document Signatures Made Simple",
	description:
		"Sign, send, and manage documents securely. A modern platform for digital signatures and workflow management.",
	url: import.meta.env.VITE_APP_URL || "https://seal.co",
	ogImage: "/favicon/og-image.png",
	twitterHandle: "@sealhq",
	locale: "en_US",
	themeColor: "#0d9488",
} as const;

// Route-specific SEO configuration
export interface PageSEO {
	title: string;
	description: string;
	canonical?: string;
	noIndex?: boolean;
	ogImage?: string;
	ogType?: "website" | "article" | "product";
}

// Pre-defined SEO for common pages
export const pageSEO: Record<string, PageSEO> = {
	home: {
		title: "Seal - Document Signatures Made Simple",
		description:
			"Sign, send, and manage documents securely. A modern platform for digital signatures and workflow management.",
		ogType: "website",
	},
	signIn: {
		title: "Sign In - Seal",
		description:
			"Sign in to your Seal account to manage your documents and signatures.",
		noIndex: true,
	},
	signUp: {
		title: "Get Started - Seal",
		description:
			"Create your free Seal account and start signing documents in minutes. No credit card required.",
	},
	sign: {
		title: "Sign Document - Seal",
		description: "Review and sign your document securely with Seal.",
		noIndex: true,
	},
	dashboard: {
		title: "Dashboard - Seal",
		description:
			"Your Seal dashboard. View recent activity and manage your documents.",
		noIndex: true,
	},
	documents: {
		title: "Documents - Seal",
		description:
			"Manage all your documents in one place. Create, send, and track signatures.",
		noIndex: true,
	},
	templates: {
		title: "Templates - Seal",
		description:
			"Create and manage reusable document templates for faster signing workflows.",
		noIndex: true,
	},
	settings: {
		title: "Settings - Seal",
		description:
			"Manage your account settings, notifications, and preferences.",
		noIndex: true,
	},
};

/**
 * Generate canonical URL for a given path
 */
export function getCanonicalUrl(path: string): string {
	const baseUrl = siteConfig.url.replace(/\/$/, "");
	const cleanPath = path.startsWith("/") ? path : `/${path}`;
	return `${baseUrl}${cleanPath}`;
}

// JSON-LD Schema Types
export interface OrganizationSchema {
	"@context": "https://schema.org";
	"@type": "Organization";
	name: string;
	url: string;
	logo: string;
	description: string;
	sameAs?: string[];
	contactPoint?: {
		"@type": "ContactPoint";
		contactType: string;
		email?: string;
	};
}

export interface ProductSchema {
	"@context": "https://schema.org";
	"@type": "SoftwareApplication";
	name: string;
	description: string;
	url: string;
	applicationCategory: string;
	operatingSystem: string;
	offers: {
		"@type": "Offer";
		price: string;
		priceCurrency: string;
		availability: string;
	};
	aggregateRating?: {
		"@type": "AggregateRating";
		ratingValue: string;
		ratingCount: string;
	};
}

/**
 * Generate Organization JSON-LD schema
 */
export function generateOrganizationSchema(): OrganizationSchema {
	return {
		"@context": "https://schema.org",
		"@type": "Organization",
		name: siteConfig.name,
		url: siteConfig.url,
		logo: `${siteConfig.url}${siteConfig.ogImage}`,
		description: siteConfig.description,
		sameAs: [
			// Add social media URLs here when available
			// "https://twitter.com/sealhq",
			// "https://linkedin.com/company/seal",
		],
		contactPoint: {
			"@type": "ContactPoint",
			contactType: "customer support",
			email: "support@seal.co",
		},
	};
}

/**
 * Generate Product/SoftwareApplication JSON-LD schema
 */
export function generateProductSchema(): ProductSchema {
	return {
		"@context": "https://schema.org",
		"@type": "SoftwareApplication",
		name: "Seal - Document Signatures",
		description: siteConfig.description,
		url: siteConfig.url,
		applicationCategory: "BusinessApplication",
		operatingSystem: "Web",
		offers: {
			"@type": "Offer",
			price: "0",
			priceCurrency: "USD",
			availability: "https://schema.org/InStock",
		},
	};
}
