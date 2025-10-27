const ORGANIZATION_ROUTE_SEGMENTS = new Set([
	"home",
	"documents",
	"templates",
	"analytics",
	"accounts",
	"budgets",
	"categories",
	"goals",
	"transactions",
	"settings",
]);

interface SplitPathResult {
	pathname: string;
	search: string;
	hash: string;
}

function splitTargetPath(target?: string | null): SplitPathResult {
	if (!target || target.trim() === "") {
		return { pathname: "/", search: "", hash: "" };
	}

	let normalized = target.trim();
	let hash = "";

	const hashIndex = normalized.indexOf("#");
	if (hashIndex >= 0) {
		hash = normalized.slice(hashIndex);
		normalized = normalized.slice(0, hashIndex);
	}

	let search = "";
	const searchIndex = normalized.indexOf("?");
	if (searchIndex >= 0) {
		search = normalized.slice(searchIndex);
		normalized = normalized.slice(0, searchIndex);
	}

	if (!normalized.startsWith("/")) {
		normalized = `/${normalized}`;
	}

	return {
		pathname: normalized === "" ? "/" : normalized,
		search,
		hash,
	};
}

function ensureOrganizationPathname(slug: string, pathname: string): string {
	if (!pathname || pathname === "") {
		return `/${slug}`;
	}

	const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;

	if (normalized === `/${slug}` || normalized.startsWith(`/${slug}/`)) {
		return normalized;
	}

	const segments = normalized.split("/").filter(Boolean);
	if (segments.length === 0) {
		return `/${slug}`;
	}

	const [first, ...rest] = segments;

	if (first && ORGANIZATION_ROUTE_SEGMENTS.has(first)) {
		return `/${slug}/${[first, ...rest].join("/")}`;
	}

	if (rest.length > 0 && rest[0] && ORGANIZATION_ROUTE_SEGMENTS.has(rest[0])) {
		return `/${slug}/${rest.join("/")}`;
	}

	return `/${slug}`;
}

export function buildOrganizationPath(
	slug: string,
	target?: string | null,
): string {
	const { pathname, search, hash } = splitTargetPath(target);
	const normalizedPathname = ensureOrganizationPathname(slug, pathname);
	return `${normalizedPathname}${search}${hash}`;
}

export function isPathWithinOrganization(
	slug: string,
	target?: string | null,
): boolean {
	const { pathname } = splitTargetPath(target);
	return pathname === `/${slug}` || pathname.startsWith(`/${slug}/`);
}
