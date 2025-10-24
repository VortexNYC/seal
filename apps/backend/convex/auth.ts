import { ConvexError } from "convex/values";
import {
	customCtx,
	customMutation,
	customQuery,
} from "convex-helpers/server/customFunctions";
import type { Doc, Id } from "./_generated/dataModel";
import {
	type MutationCtx,
	mutation,
	type QueryCtx,
	query,
} from "./_generated/server";
import { AuthUtils } from "./auth.utils";
import type { MemberStatus, OrganizationRole, UserType } from "./schema";

export type AuthContext = {
	member: Doc<"organization_members">;
	user: Doc<"users">;
	organization: Doc<"organizations">;
	subscription?: Doc<"subscriptions">; // Active subscription (if any)

	// User type information
	userType: UserType;

	// Utility methods
	hasPermission: (permission: string) => boolean;
	hasRole: (role: OrganizationRole) => boolean;
	canAccessOrganization: (orgId: Id<"organizations">) => boolean;

	// Type-specific helpers
	isPersonalUser: () => boolean;
	isBusinessUser: () => boolean;
	isOwner: () => boolean;
	isAdmin: () => boolean;

	// Financial-specific helpers
	canManageFinances: () => boolean;
	canManageSubscription: () => boolean;
	canManageMembers: () => boolean;
};

/**
 * Authentication error types
 */
export const AuthErrorType = {
	NO_IDENTITY: "NO_IDENTITY",
	NO_USER_RECORD: "NO_USER_RECORD",
	NO_MEMBER_RECORD: "NO_MEMBER_RECORD",
	NO_ORGANIZATION: "NO_ORGANIZATION",
	NO_SUBSCRIPTION: "NO_SUBSCRIPTION",
	INSUFFICIENT_PERMISSIONS: "INSUFFICIENT_PERMISSIONS",
	INSUFFICIENT_ROLE: "INSUFFICIENT_ROLE",
	ACCOUNT_INACTIVE: "ACCOUNT_INACTIVE",
	ACCOUNT_SUSPENDED: "ACCOUNT_SUSPENDED",
	ACCOUNT_PENDING: "ACCOUNT_PENDING",
	ACCOUNT_BLOCKED: "ACCOUNT_BLOCKED",
	WRONG_ORGANIZATION: "WRONG_ORGANIZATION",
	SUBSCRIPTION_EXPIRED: "SUBSCRIPTION_EXPIRED",
	SUBSCRIPTION_REQUIRED: "SUBSCRIPTION_REQUIRED",
};

/**
 * Authentication error class for consistent error handling
 */
export class AuthError extends Error {
	type: keyof typeof AuthErrorType;
	metadata?: Record<string, unknown>;

	constructor(
		type: keyof typeof AuthErrorType,
		message: string,
		metadata?: Record<string, unknown>,
	) {
		super(message);
		this.name = "AuthError";
		this.type = type;
		this.metadata = metadata;
	}
}

/**
 * Helper function to create authentication errors
 */
export function createAuthError(
	type: keyof typeof AuthErrorType,
	message?: string,
	metadata?: Record<string, unknown>,
): AuthError {
	const defaultMessages: Record<keyof typeof AuthErrorType, string> = {
		NO_IDENTITY: "User identity not found",
		NO_USER_RECORD: "User record not found",
		NO_MEMBER_RECORD: "Member record not found",
		NO_ORGANIZATION: "Organization not found",
		NO_SUBSCRIPTION: "Subscription not found",
		INSUFFICIENT_PERMISSIONS: "Insufficient permissions",
		INSUFFICIENT_ROLE: "Insufficient role level",
		ACCOUNT_INACTIVE: "Account is inactive",
		ACCOUNT_SUSPENDED: "Account is suspended",
		ACCOUNT_PENDING: "Account is pending approval",
		ACCOUNT_BLOCKED: "Account is blocked",
		WRONG_ORGANIZATION: "Cannot access resources from different organization",
		SUBSCRIPTION_EXPIRED: "Subscription has expired",
		SUBSCRIPTION_REQUIRED: "Active subscription required",
	};

	return new AuthError(type, message || defaultMessages[type], metadata);
}

/**
 * Get authenticated user context from Convex with optimized queries
 */
export async function getAuthContext(
	ctx: QueryCtx | MutationCtx,
): Promise<AuthContext> {
	// 1. Get user identity and basic user record
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) {
		throw new ConvexError(createAuthError("NO_IDENTITY").message);
	}

	const user = await ctx.db
		.query("users")
		.withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
		.first();

	if (!user) {
		// User doesn't exist yet - this should rarely happen now
		// ensureMyMembership handles inline user creation
		throw new ConvexError(
			createAuthError(
				"NO_USER_RECORD",
				"User record not found. Please try refreshing the page.",
				{
					clerkId: identity.subject,
				},
			).message,
		);
	}

	if (!user.activeOrganizationId) {
		// User exists but has no organization
		// This should trigger ensureMyMembership call from frontend
		throw new ConvexError(
			createAuthError(
				"NO_ORGANIZATION",
				"Organization setup required. This will be handled automatically - please try again.",
				{
					userId: user._id,
					hint: "CALL_ENSURE_MEMBERSHIP", // Hint for frontend error handling
				},
			).message,
		);
	}

	// 2. Single query to get member with denormalized data (major optimization)
	const member = await ctx.db
		.query("organization_members")
		.withIndex("by_user_organization", (q) =>
			q
				.eq("userId", user._id)
				.eq("organizationId", user.activeOrganizationId as Id<"organizations">),
		)
		.first();

	if (!member) {
		throw new ConvexError(
			createAuthError("NO_MEMBER_RECORD", undefined, {
				userId: user._id,
				organizationId: user.activeOrganizationId,
			}).message,
		);
	}

	// 3. Get organization (could be cached in the future)
	const organization = await ctx.db.get(user.activeOrganizationId);
	if (!organization) {
		throw new ConvexError(
			createAuthError("NO_ORGANIZATION", undefined, {
				userId: user._id,
				organizationId: user.activeOrganizationId,
			}).message,
		);
	}

	// 4. Validate account status
	if (!AuthUtils.isAccountValid(member)) {
		const errorType = getStatusErrorType(member.status);
		throw new ConvexError(
			createAuthError(errorType, undefined, {
				userId: user._id,
				status: member.status,
			}).message,
		);
	}

	// 5. Load subscription data (if user has an active subscription)
	let subscription: Doc<"subscriptions"> | undefined;

	const activeSubscription = await ctx.db
		.query("subscriptions")
		.withIndex("by_user_id", (q) => q.eq("userId", user._id))
		.filter((q) => q.eq(q.field("status"), "active"))
		.first();

	if (activeSubscription) {
		subscription = activeSubscription;
	}

	// 6. Return optimized context with financial-specific data
	return {
		member,
		user,
		organization,
		subscription,
		userType: "personal" as UserType, // Default type since userType field removed

		// Utility methods
		hasPermission: (permission) => AuthUtils.hasPermission(member, permission),
		hasRole: (role) => AuthUtils.hasRole(member, role),
		canAccessOrganization: (orgId) =>
			AuthUtils.canAccessOrganization(member, orgId),

		// Type-specific helpers
		isPersonalUser: () => true, // Default behavior since userType removed
		isBusinessUser: () => false, // Default behavior since userType removed
		isOwner: () => AuthUtils.isOwner(member),
		isAdmin: () => AuthUtils.isAdmin(member),

		// Financial-specific helpers
		canManageFinances: () => AuthUtils.canManageSubscription(member),
		canManageSubscription: () => AuthUtils.canManageSubscription(member),
		canManageMembers: () => AuthUtils.canManageMembers(member),
	};
}

/**
 * Map user status to error type
 */
function getStatusErrorType(status: MemberStatus): keyof typeof AuthErrorType {
	switch (status) {
		case "inactive":
			return "ACCOUNT_INACTIVE";
		case "suspended":
			return "ACCOUNT_SUSPENDED";
		case "pending":
			return "ACCOUNT_PENDING";
		case "blocked":
			return "ACCOUNT_BLOCKED";
		default:
			return "ACCOUNT_INACTIVE";
	}
}

/**
 * Basic authenticated query
 */
export const authQuery = customQuery(
	query,
	customCtx(async (ctx) => {
		const auth = await getAuthContext(ctx);
		return { auth };
	}),
);

export type AuthQueryCtx = Awaited<ReturnType<typeof authQuery>>;

/**
 * Basic authenticated mutation
 *
 * Automatically calls ensureMyMembership if user has no organization
 */
export const authMutation = customMutation(
	mutation,
	customCtx(async (ctx) => {
		const auth = await getAuthContext(ctx);
		return { auth };
	}),
);

export type AuthMutationCtx = Awaited<ReturnType<typeof authMutation>>;

export const adminQuery = customQuery(
	query,
	customCtx(async (ctx) => {
		const auth = await getAuthContext(ctx);

		if (!auth.hasRole("admin")) {
			throw new ConvexError(
				createAuthError("INSUFFICIENT_ROLE", undefined, {
					userId: auth.user._id,
					userRole: auth.member.role,
					requiredRole: "admin",
				}).message,
			);
		}

		return {
			auth,
			db: ctx.db,
			runQuery: ctx.runQuery,
		};
	}),
);

export type AdminQueryCtx = Awaited<ReturnType<typeof adminQuery>>;

export const adminMutation = customMutation(
	mutation,
	customCtx(async (ctx) => {
		const auth = await getAuthContext(ctx);

		if (!auth.hasRole("admin")) {
			throw new ConvexError(
				createAuthError("INSUFFICIENT_ROLE", undefined, {
					userId: auth.user._id,
					userRole: auth.member.role,
					requiredRole: "admin",
				}).message,
			);
		}

		return {
			auth,
			db: ctx.db,
			runQuery: ctx.runQuery,
			runMutation: ctx.runMutation,
		};
	}),
);

export type AdminMutationCtx = Awaited<ReturnType<typeof adminMutation>>;

/**
 * Member-level authenticated query
 * Requires at least "member" role (member, admin, or owner)
 */
export const memberQuery = customQuery(
	query,
	customCtx(async (ctx) => {
		const auth = await getAuthContext(ctx);

		if (!auth.hasRole("member")) {
			throw new ConvexError(
				createAuthError("INSUFFICIENT_ROLE", undefined, {
					userId: auth.user._id,
					userRole: auth.member.role,
					requiredRole: "member",
				}).message,
			);
		}

		return {
			auth,
			db: ctx.db,
			runQuery: ctx.runQuery,
		};
	}),
);

export type MemberQueryCtx = Awaited<ReturnType<typeof memberQuery>>;

/**
 * Member-level authenticated mutation
 * Requires at least "member" role (member, admin, or owner)
 */
export const memberMutation = customMutation(
	mutation,
	customCtx(async (ctx) => {
		const auth = await getAuthContext(ctx);

		if (!auth.hasRole("member")) {
			throw new ConvexError(
				createAuthError("INSUFFICIENT_ROLE", undefined, {
					userId: auth.user._id,
					userRole: auth.member.role,
					requiredRole: "member",
				}).message,
			);
		}

		return {
			auth,
			db: ctx.db,
			runQuery: ctx.runQuery,
			runMutation: ctx.runMutation,
		};
	}),
);

export type MemberMutationCtx = Awaited<ReturnType<typeof memberMutation>>;
