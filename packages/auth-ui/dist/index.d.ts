import * as react from 'react';
import { ReactNode } from 'react';
import { ButtonProps } from '@cloudflare/kumo/components/button';
export { render } from 'react-email';

/**
 * Result shape returned by Better Auth client actions.
 */
interface AuthResult {
    data?: unknown;
    error: {
        message?: string;
    } | null;
}
/**
 * A generic Better Auth session state.
 */
interface AuthSessionState {
    data?: {
        user?: AuthUser | null;
    } | null;
    error?: {
        message?: string;
    } | null;
    isPending?: boolean;
}
/**
 * Shape of a Better Auth user exposed by the default session payload.
 * Consumers with custom user fields can narrow this via the generic client.
 */
interface AuthUser {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
}
/**
 * Generic Better Auth client contract.
 *
 * This is intentionally a hand-written shape rather than a deep inference of
 * `createAuthClient` so the package can work across any plugin combination
 * without coupling to Better Auth's internal method overloads.
 */
interface AnyAuthClient {
    useSession(): AuthSessionState;
    signOut(args?: {
        fetchOptions?: unknown;
    }): Promise<AuthResult>;
    signIn: {
        email(args: {
            email: string;
            password: string;
            callbackURL?: string;
        }): Promise<AuthResult>;
        social?(args: {
            provider: string;
            callbackURL?: string;
        }): Promise<AuthResult>;
        magicLink?(args: {
            email: string;
            callbackURL?: string;
        }): Promise<AuthResult>;
    };
    signUp: {
        email(args: {
            name: string;
            email: string;
            password: string;
            callbackURL?: string;
        }): Promise<AuthResult>;
    };
    /** Magic link sign-in and verification. */
    magicLink?: {
        verify(args: {
            token: string;
            callbackURL?: string;
        }): Promise<AuthResult>;
    };
    /** Password recovery. */
    forgetPassword?: (args: {
        email: string;
        redirectTo?: string;
    }) => Promise<AuthResult>;
    resetPassword?: (args: {
        newPassword: string;
        token: string;
    }) => Promise<AuthResult>;
    /** Email verification and change. */
    sendVerificationEmail?: (args: {
        email: string;
        callbackURL?: string;
    }) => Promise<AuthResult>;
    verifyEmail?: (args: {
        query: {
            token: string;
        };
    }) => Promise<AuthResult>;
    changeEmail?: (args: {
        newEmail: string;
        callbackURL?: string;
    }) => Promise<AuthResult>;
    /** Profile and session management. */
    updateUser?: (args: {
        name?: string;
        image?: string | null;
    }) => Promise<AuthResult>;
    changePassword?: (args: {
        currentPassword: string;
        newPassword: string;
        revokeOtherSessions?: boolean;
    }) => Promise<AuthResult>;
    deleteUser?: (args: {
        password?: string;
        callbackURL?: string;
        token?: string;
    }) => Promise<AuthResult>;
    setPassword?: (args: {
        newPassword: string;
    }) => Promise<AuthResult>;
    listSessions?: () => Promise<{
        data?: unknown[] | null;
        error: AuthResult["error"];
    }>;
    revokeSession?: (args: {
        token: string;
    }) => Promise<AuthResult>;
    revokeOtherSessions?: () => Promise<AuthResult>;
    /** Social account linking. */
    listAccounts?: () => Promise<{
        data?: AuthAccount[] | null;
        error: AuthResult["error"];
    }>;
    linkSocial?: (args: {
        provider: string;
        callbackURL?: string;
        errorCallbackURL?: string;
    }) => Promise<AuthResult>;
    unlinkAccount?: (args: {
        providerId: string;
        accountId: string;
    }) => Promise<AuthResult>;
    /** Two-factor authentication (TOTP + backup codes). */
    twoFactor?: {
        enable(args: {
            password: string;
            issuer?: string;
        }): Promise<{
            data?: {
                totpURI?: string;
                backupCodes?: string[];
            } | null;
            error: AuthResult["error"];
        }>;
        verifyTotp(args: {
            code: string;
            trustDevice?: boolean;
        }): Promise<AuthResult>;
        verifyBackupCode(args: {
            code: string;
            trustDevice?: boolean;
        }): Promise<AuthResult>;
        disable(args: {
            password: string;
        }): Promise<AuthResult>;
        generateBackupCodes(args: {
            password: string;
        }): Promise<{
            data?: {
                backupCodes?: string[];
            } | null;
            error: AuthResult["error"];
        }>;
    };
    /** Organizations (Better Auth organization plugin). */
    organization?: {
        list(): Promise<{
            data?: AuthOrganization[] | null;
            error: AuthResult["error"];
        }>;
        create(args: {
            name: string;
            slug: string;
            logo?: string;
            metadata?: Record<string, unknown>;
            keepCurrentActiveOrganization?: boolean;
        }): Promise<{
            data?: AuthOrganization | null;
            error: AuthResult["error"];
        }>;
        delete(args: {
            organizationId: string;
        }): Promise<AuthResult>;
        update(args: {
            data: {
                name?: string;
                slug?: string;
                logo?: string | null;
                metadata?: Record<string, unknown>;
            };
            organizationId?: string;
        }): Promise<{
            data?: AuthOrganization | null;
            error: AuthResult["error"];
        }>;
        setActive(args: {
            organizationId?: string | null;
            organizationSlug?: string;
        }): Promise<AuthResult>;
        getFullOrganization(args?: {
            query?: {
                organizationId?: string;
                organizationSlug?: string;
                membersLimit?: number;
            };
        }): Promise<{
            data?: AuthOrganizationFull | null;
            error: AuthResult["error"];
        }>;
        checkSlug(args: {
            slug: string;
        }): Promise<{
            data?: {
                status: boolean;
            } | null;
            error: AuthResult["error"];
        }>;
        listUserInvitations(): Promise<{
            data?: AuthInvitation[] | null;
            error: AuthResult["error"];
        }>;
        inviteMember(args: {
            email: string;
            role: string | string[];
            organizationId?: string;
            resend?: boolean;
        }): Promise<{
            data?: AuthInvitation | null;
            error: AuthResult["error"];
        }>;
        acceptInvitation(args: {
            invitationId: string;
        }): Promise<AuthResult>;
        rejectInvitation(args: {
            invitationId: string;
        }): Promise<AuthResult>;
        cancelInvitation(args: {
            invitationId: string;
        }): Promise<AuthResult>;
        removeMember(args: {
            memberIdOrEmail: string;
            organizationId?: string;
        }): Promise<AuthResult>;
        updateMemberRole(args: {
            memberId: string;
            role: string | string[];
            organizationId?: string;
        }): Promise<AuthResult>;
        getActiveMemberRole(): Promise<{
            data?: {
                role: string;
            } | null;
            error: AuthResult["error"];
        }>;
    };
}
interface AuthAccount {
    id: string;
    providerId: string;
    accountId: string;
    userId: string;
    scopes?: string[];
    createdAt?: string | Date;
    updatedAt?: string | Date;
}
interface AuthOrganization {
    id: string;
    name: string;
    slug: string;
    logo?: string | null;
    metadata?: Record<string, unknown>;
    createdAt?: string | Date;
}
interface AuthOrganizationFull extends AuthOrganization {
    members: AuthMember[];
    invitations: AuthInvitation[];
}
interface AuthMember {
    id: string;
    organizationId: string;
    userId: string;
    role: string;
    createdAt?: string | Date;
    updatedAt?: string | Date;
    user?: {
        id: string;
        email: string;
        name: string;
        image?: string | null;
    } | null;
}
interface AuthInvitation {
    id: string;
    organizationId?: string;
    email: string;
    role?: string;
    status?: "pending" | "accepted" | "rejected" | "canceled";
    inviterId?: string;
    expiresAt?: string | Date;
    createdAt?: string | Date;
}
/**
 * Shared form props for all auth forms.
 */
interface AuthFormBaseProps {
    className?: string;
    errorClassName?: string;
    onSuccess?: () => void;
}

interface AuthProviderProps {
    client: AnyAuthClient;
    children: ReactNode;
}
/**
 * Provides the typed Better Auth client to all `@vortexnyc/better-auth-ui`
 * components through React context.
 */
declare function AuthProvider({ client, children }: AuthProviderProps): react.JSX.Element;
/**
 * Hook to access the auth client inside `AuthProvider`.
 * Throws if called outside the provider.
 */
declare function useAuth(): AnyAuthClient;

interface AuthenticatedProps {
    children: ReactNode;
    fallback?: ReactNode;
    loading?: ReactNode;
}
/**
 * Renders `children` only when the user is signed in.
 */
declare function Authenticated({ children, fallback, loading, }: AuthenticatedProps): ReactNode;
interface UnauthenticatedProps {
    children: ReactNode;
    fallback?: ReactNode;
    loading?: ReactNode;
}
/**
 * Renders `children` only when the user is signed out.
 */
declare function Unauthenticated({ children, fallback, loading, }: UnauthenticatedProps): ReactNode;
interface AuthLoadingProps {
    children: ReactNode;
    fallback?: ReactNode;
}
/**
 * Renders `children` only while the auth session is still loading.
 */
declare function AuthLoading({ children, fallback }: AuthLoadingProps): ReactNode;

interface SignOutButtonProps {
    children?: ReactNode;
    className?: string;
    variant?: ButtonProps["variant"];
    size?: ButtonProps["size"];
    loading?: boolean;
    disabled?: boolean;
    redirectTo?: string;
    onSuccess?: () => void;
    onError?: (message: string) => void;
}
/**
 * Button that signs the user out through Better Auth and optionally redirects.
 */
declare function SignOutButton({ redirectTo, onSuccess, onError, children, className, variant, size, loading, disabled, }: SignOutButtonProps): react.JSX.Element;

interface UserButtonProps {
    className?: string;
    redirectTo?: string;
    onSignOut?: () => void;
    onSignOutError?: (message: string) => void;
}
/**
 * Compact user menu with sign-out.
 *
 * Renders the current user's name/image as a trigger and drops down a
 * sign-out action. Returns null while session is loading or unavailable.
 */
declare function UserButton({ className, redirectTo, onSignOut, onSignOutError, }: UserButtonProps): react.JSX.Element | null;

interface AuthProviderOption {
    provider: string;
    label: string;
    icon?: ReactNode;
    disabled?: boolean;
}
interface AuthProviderButtonsProps {
    providers: readonly AuthProviderOption[];
    onSelect: (providerId: string) => void | Promise<void>;
    isSubmitting?: boolean;
    className?: string;
    providerButtonClassName?: string;
}
/**
 * Renders a stack of social/provider sign-in buttons.
 */
declare function AuthProviderButtons({ providers, onSelect, isSubmitting, className, providerButtonClassName, }: AuthProviderButtonsProps): react.JSX.Element;
interface AuthDividerProps {
    label?: string;
    className?: string;
}
/**
 * A centered divider with optional label (e.g. "or").
 */
declare function AuthDivider({ label, className }: AuthDividerProps): react.JSX.Element;
interface AuthCardProps {
    children: ReactNode;
    className?: string;
    title: ReactNode;
    description?: ReactNode;
}
/**
 * Page-level card for auth forms using Kumo `LayerCard`.
 */
declare function AuthCard({ children, className, title, description, }: AuthCardProps): react.JSX.Element;
interface AuthErrorProps {
    message?: string | null;
    className?: string;
}
/**
 * Error banner for auth-level messages.
 */
declare function AuthError({ message, className }: AuthErrorProps): react.JSX.Element | null;
type AuthSubmitButtonProps = ButtonProps;
/**
 * Primary submit button wired to a loading state.
 */
declare function AuthSubmitButton({ loading, children, ...props }: AuthSubmitButtonProps): react.JSX.Element;

interface SignInFormProps extends AuthFormBaseProps {
    title?: string;
    description?: string;
    redirectTo?: string;
    forgotPasswordHref?: string;
    signUpUrl?: string;
    submitLabel?: string;
    submittingLabel?: string;
    providers?: readonly AuthProviderOption[];
    onProviderSelect?: (providerId: string) => void | Promise<void>;
    dividerLabel?: string;
}
/**
 * Email/password sign-in form built on Kumo UI.
 *
 * Reads the typed Better Auth client from `AuthProvider`, validates input with
 * Zod, and calls `client.signIn.email`.
 */
declare function SignInForm({ title, description, redirectTo, forgotPasswordHref, signUpUrl, className, errorClassName, submitLabel, submittingLabel, providers, onProviderSelect, dividerLabel, onSuccess, }: SignInFormProps): react.JSX.Element;

interface SignUpFormProps extends AuthFormBaseProps {
    title?: string;
    description?: string;
    redirectTo?: string;
    signInUrl?: string;
    submitLabel?: string;
    submittingLabel?: string;
    providers?: readonly AuthProviderOption[];
    onProviderSelect?: (providerId: string) => void | Promise<void>;
    dividerLabel?: string;
}
/**
 * Email/password sign-up form built on Kumo UI.
 */
declare function SignUpForm({ title, description, redirectTo, signInUrl, className, errorClassName, submitLabel, submittingLabel, providers, onProviderSelect, dividerLabel, onSuccess, }: SignUpFormProps): react.JSX.Element;

interface MagicLinkSignInFormProps extends AuthFormBaseProps {
    redirectTo?: string;
    title?: string;
    description?: string;
    emailLabel?: string;
    submitLabel?: string;
    submittingLabel?: string;
    successMessage?: string;
    unavailableMessage?: string;
}
/**
 * Form for signing in with a magic link.
 *
 * Requires the Better Auth `magicLink` plugin. After submission the user
 * receives an email with a sign-in link.
 */
declare function MagicLinkSignInForm({ redirectTo, title, description, className, errorClassName, emailLabel, submitLabel, submittingLabel, successMessage, unavailableMessage, }: MagicLinkSignInFormProps): react.JSX.Element;

interface MagicLinkVerifyProps extends AuthFormBaseProps {
    token?: string;
    callbackURL?: string;
    title?: string;
    description?: string;
    verifyingMessage?: string;
    verifiedMessage?: string;
    missingTokenMessage?: string;
    unavailableMessage?: string;
}
/**
 * Screen that verifies a magic-link token on mount.
 *
 * The user lands here from the magic-link email (token in `?token=…`).
 * On success it optionally redirects to `callbackURL` and calls `onSuccess`.
 */
declare function MagicLinkVerify({ token, callbackURL, title, description, className, errorClassName, verifyingMessage, verifiedMessage, missingTokenMessage, unavailableMessage, onSuccess, }: MagicLinkVerifyProps): react.JSX.Element;

interface ForgotPasswordFormProps extends AuthFormBaseProps {
    title?: string;
    description?: string;
    resetPasswordUrl?: string;
    signInUrl?: string;
    submitLabel?: string;
    submittingLabel?: string;
    successMessage?: string;
}
/**
 * Forgot password form built on Kumo UI.
 */
declare function ForgotPasswordForm({ title, description, resetPasswordUrl, signInUrl, className, errorClassName, submitLabel, submittingLabel, successMessage, onSuccess, }: ForgotPasswordFormProps): react.JSX.Element;

interface ResetPasswordFormProps extends AuthFormBaseProps {
    token: string;
    title?: string;
    description?: string;
    submitLabel?: string;
    submittingLabel?: string;
    successMessage?: string;
}
/**
 * Password reset completion form built on Kumo UI.
 */
declare function ResetPasswordForm({ token, title, description, className, errorClassName, submitLabel, submittingLabel, successMessage, onSuccess, }: ResetPasswordFormProps): react.JSX.Element;

interface VerifyEmailFormProps extends AuthFormBaseProps {
    token?: string;
    userEmail?: string | null;
    callbackUrl?: string;
    title?: string;
    description?: string;
    verifiedMessage?: string;
    sendLabel?: string;
    sendingLabel?: string;
}
/**
 * Email verification screen built on Kumo UI.
 *
 * If `token` is provided, the form attempts to verify it automatically on
 * mount. If no token is provided, it offers a send-verification-email flow.
 */
declare function VerifyEmailForm({ token, userEmail, callbackUrl, title, description, className, errorClassName, verifiedMessage, sendLabel, sendingLabel, onSuccess, }: VerifyEmailFormProps): react.JSX.Element;

interface EnableTwoFactorFormProps extends AuthFormBaseProps {
    issuer?: string;
    qrCode?: (totpURI: string) => ReactNode;
    title?: string;
    description?: string;
    passwordLabel?: string;
    codeLabel?: string;
    secretLabel?: string;
    verifyTitle?: string;
    verifyDescription?: string;
    backupTitle?: string;
    backupDescription?: string;
    submitLabel?: string;
    verifyLabel?: string;
    doneLabel?: string;
    submittingLabel?: string;
    verifyingLabel?: string;
    unavailableMessage?: string;
}
/**
 * TOTP enrollment flow built on Kumo UI.
 *
 * Three steps:
 * 1. Re-authenticate with password and call `twoFactor.enable`.
 * 2. Display the TOTP secret / optional QR code and collect a 6-digit code.
 * 3. Confirm enrollment and show one-time backup codes.
 *
 * The component deliberately does not bundle a QR library. Pass `qrCode` to
 * render a QR code from the `otpauth://` URI (e.g. with `react-qr-code`).
 */
declare function EnableTwoFactorForm({ issuer, qrCode, title, description, className, errorClassName, passwordLabel, codeLabel, secretLabel, verifyTitle, verifyDescription, backupTitle, backupDescription, submitLabel, verifyLabel, doneLabel, submittingLabel, verifyingLabel, unavailableMessage, onSuccess, }: EnableTwoFactorFormProps): react.JSX.Element;

interface VerifyTotpFormProps extends AuthFormBaseProps {
    title?: string;
    description?: string;
    submitLabel?: string;
    submittingLabel?: string;
    unavailableMessage?: string;
    showTrustDevice?: boolean;
    trustDeviceLabel?: string;
}
/**
 * TOTP verification step, used to finish 2FA enrollment or satisfy a sign-in
 * step-up after the primary password challenge.
 */
declare function VerifyTotpForm({ title, description, className, errorClassName, submitLabel, submittingLabel, unavailableMessage, showTrustDevice, trustDeviceLabel, onSuccess, }: VerifyTotpFormProps): react.JSX.Element;

interface SessionListProps {
    title?: string;
    description?: string;
    className?: string;
    errorClassName?: string;
    currentSessionToken?: string | null;
    showRevokeOthersAction?: boolean;
    loadingLabel?: string;
    emptyLabel?: string;
    revokeLabel?: string;
    revokingLabel?: string;
    revokeOthersLabel?: string;
    revokingOthersLabel?: string;
    currentBadgeLabel?: string;
    lastActivePrefix?: string;
    formatTimestamp?: (value: string | Date) => string;
    onRevoke?: () => void;
}
/**
 * List active Better Auth sessions with per-session and bulk revoke actions.
 */
declare function SessionList({ title, description, className, errorClassName, currentSessionToken, showRevokeOthersAction, loadingLabel, emptyLabel, revokeLabel, revokingLabel, revokeOthersLabel, revokingOthersLabel, currentBadgeLabel, lastActivePrefix, formatTimestamp, onRevoke, }: SessionListProps): react.JSX.Element;

interface CreateOrganizationFormProps {
    className?: string;
    errorClassName?: string;
    title?: string;
    description?: string;
    submitLabel?: string;
    submittingLabel?: string;
    cancelLabel?: string;
    showCancel?: boolean;
    onSuccess?: (organization: AuthOrganization) => void;
    onCancel?: () => void;
}
/**
 * Form for creating a new Better Auth organization.
 */
declare function CreateOrganizationForm({ className, errorClassName, title, description, submitLabel, submittingLabel, cancelLabel, showCancel, onSuccess, onCancel, }: CreateOrganizationFormProps): react.JSX.Element;

interface OrganizationListProps {
    className?: string;
    errorClassName?: string;
    title?: string;
    description?: string;
    membershipsLabel?: string;
    invitationsLabel?: string;
    currentLabel?: string;
    selectLabel?: string;
    acceptLabel?: string;
    rejectLabel?: string;
    createLabel?: string;
    noOrganizationsLabel?: string;
    noInvitationsLabel?: string;
    loadingLabel?: string;
    currentOrganizationId?: string | null;
    showCreateButton?: boolean;
    onSelectOrganization?: (organization: AuthOrganization) => void;
    onCreateOrganization?: () => void;
    onAcceptInvitation?: (invitation: AuthInvitation) => void;
    onRejectInvitation?: (invitation: AuthInvitation) => void;
}
/**
 * Card that lists the user's Better Auth organizations and pending invitations.
 */
declare function OrganizationList({ className, errorClassName, title, description, membershipsLabel, invitationsLabel, currentLabel, selectLabel, acceptLabel, rejectLabel, createLabel, noOrganizationsLabel, noInvitationsLabel, loadingLabel, currentOrganizationId, showCreateButton, onSelectOrganization, onCreateOrganization, onAcceptInvitation, onRejectInvitation, }: OrganizationListProps): react.JSX.Element;

interface OrganizationSwitcherProps {
    className?: string;
    errorClassName?: string;
    currentOrganizationId?: string | null;
    title?: string;
    description?: string;
    placeholder?: string;
    createLabel?: string;
    loadingLabel?: string;
    emptyLabel?: string;
    personalAccountLabel?: string;
    showPersonalAccount?: boolean;
    showCreateButton?: boolean;
    onChange?: (organization: AuthOrganization | null) => void;
    onCreateOrganization?: () => void;
}
/**
 * Dropdown-style workspace switcher backed by Better Auth.
 *
 * Uses Kumo `Select` so the consumer does not need to build a custom popover.
 */
declare function OrganizationSwitcher({ className, errorClassName, currentOrganizationId, title, description, placeholder, createLabel, loadingLabel, emptyLabel, personalAccountLabel, showPersonalAccount, showCreateButton, onChange, onCreateOrganization, }: OrganizationSwitcherProps): react.JSX.Element;

interface OrganizationProfileProps {
    className?: string;
    errorClassName?: string;
    title?: string;
    description?: string;
    nameLabel?: string;
    slugLabel?: string;
    logoLabel?: string;
    saveLabel?: string;
    savingLabel?: string;
    deleteLabel?: string;
    deletingLabel?: string;
    deletedMessage?: string;
    /** Target a specific organization instead of the active session organization. */
    organizationId?: string;
    onUpdated?: (organization: AuthOrganizationFull) => void;
    onDeleted?: () => void;
}
/**
 * Manage the active Better Auth organization: edit name/slug/logo and delete.
 *
 * Loads the current full organization from `getFullOrganization`.
 */
declare function OrganizationProfile({ className, errorClassName, title, description, nameLabel, slugLabel, logoLabel, saveLabel, savingLabel, deleteLabel, deletingLabel, deletedMessage, organizationId: targetOrganizationId, onUpdated, onDeleted, }: OrganizationProfileProps): react.JSX.Element;

interface InviteMemberFormProps {
    className?: string;
    errorClassName?: string;
    title?: string;
    description?: string;
    emailLabel?: string;
    roleLabel?: string;
    submitLabel?: string;
    submittingLabel?: string;
    roleOptions?: readonly string[];
    defaultRole?: string;
    onInvite?: (invitation: AuthInvitation) => void;
}
/**
 * Invite a member to the active organization.
 */
declare function InviteMemberForm({ className, errorClassName, title, description, emailLabel, roleLabel, submitLabel, submittingLabel, roleOptions, defaultRole, onInvite, }: InviteMemberFormProps): react.JSX.Element;
interface OrganizationMembersProps {
    className?: string;
    errorClassName?: string;
    title?: string;
    description?: string;
    loadingLabel?: string;
    emptyLabel?: string;
    membersLabel?: string;
    invitationsLabel?: string;
    removeLabel?: string;
    cancelLabel?: string;
    updateRoleLabel?: string;
    roleOptions?: readonly string[];
    canManageMembers?: boolean;
    onMemberRemoved?: () => void;
    onInvitationCancelled?: () => void;
}
/**
 * List, edit, and manage members of the active organization.
 *
 * Loads the current full organization and shows members plus pending
 * invitations. Use with `InviteMemberForm` to add people.
 */
declare function OrganizationMembers({ className, errorClassName, title, description, loadingLabel, emptyLabel, membersLabel, invitationsLabel, removeLabel, cancelLabel, updateRoleLabel, roleOptions, canManageMembers, onMemberRemoved, onInvitationCancelled, }: OrganizationMembersProps): react.JSX.Element;

interface AcceptInviteScreenProps {
    token: string;
    className?: string;
    errorClassName?: string;
    title?: string;
    description?: string;
    successMessage?: string;
    unavailableMessage?: string;
    onSuccess?: () => void;
    onSignIn?: () => void;
    signInLabel?: string;
}
/**
 * Screen that accepts a Better Auth organization invitation.
 *
 * If no session exists, `onSignIn` is called so the consumer can redirect to
 * sign-in. On a successful accept, `onSuccess` is invoked.
 */
declare function AcceptInviteScreen({ token, className, errorClassName, title, description, successMessage, unavailableMessage, onSuccess, onSignIn, signInLabel, }: AcceptInviteScreenProps): react.JSX.Element;

interface UserProfileFormProps {
    className?: string;
    errorClassName?: string;
    title?: string;
    description?: string;
    nameLabel?: string;
    imageUrlLabel?: string;
    imageUrlPlaceholder?: string;
    submitLabel?: string;
    submittingLabel?: string;
    unavailableMessage?: string;
    onSuccess?: () => void;
}
/**
 * Form for updating the current Better Auth user's name and profile image.
 */
declare function UserProfileForm({ className, errorClassName, title, description, nameLabel, imageUrlLabel, imageUrlPlaceholder, submitLabel, submittingLabel, unavailableMessage, onSuccess, }: UserProfileFormProps): react.JSX.Element;

interface ChangeEmailFormProps {
    className?: string;
    errorClassName?: string;
    title?: string;
    description?: string;
    emailLabel?: string;
    submitLabel?: string;
    submittingLabel?: string;
    successMessage?: string;
    unavailableMessage?: string;
    callbackURL?: string;
    onSuccess?: () => void;
}
/**
 * Form for changing the current user's email address via Better Auth.
 *
 * When email verification is required, Better Auth will send a confirmation link
 * to the new address using `callbackURL` as the redirect target.
 */
declare function ChangeEmailForm({ className, errorClassName, title, description, emailLabel, submitLabel, submittingLabel, successMessage, unavailableMessage, callbackURL, onSuccess, }: ChangeEmailFormProps): react.JSX.Element;

interface VerifyBackupCodeFormProps {
    className?: string;
    errorClassName?: string;
    title?: string;
    description?: string;
    codeLabel?: string;
    submitLabel?: string;
    submittingLabel?: string;
    trustDeviceLabel?: string;
    unavailableMessage?: string;
    onSuccess?: () => void;
}
/**
 * Form for verifying a two-factor backup code.
 */
declare function VerifyBackupCodeForm({ className, errorClassName, title, description, codeLabel, submitLabel, submittingLabel, trustDeviceLabel, unavailableMessage, onSuccess, }: VerifyBackupCodeFormProps): react.JSX.Element;

interface DisableTwoFactorFormProps {
    className?: string;
    errorClassName?: string;
    title?: string;
    description?: string;
    passwordLabel?: string;
    submitLabel?: string;
    submittingLabel?: string;
    unavailableMessage?: string;
    onSuccess?: () => void;
}
/**
 * Form for disabling two-factor authentication.
 */
declare function DisableTwoFactorForm({ className, errorClassName, title, description, passwordLabel, submitLabel, submittingLabel, unavailableMessage, onSuccess, }: DisableTwoFactorFormProps): react.JSX.Element;

interface GenerateBackupCodesFormProps {
    className?: string;
    errorClassName?: string;
    title?: string;
    description?: string;
    passwordLabel?: string;
    submitLabel?: string;
    submittingLabel?: string;
    doneLabel?: string;
    savedWarning?: string;
    unavailableMessage?: string;
    onSuccess?: (codes: string[]) => void;
}
/**
 * Form for generating new two-factor backup codes.
 */
declare function GenerateBackupCodesForm({ className, errorClassName, title, description, passwordLabel, submitLabel, submittingLabel, doneLabel, savedWarning, unavailableMessage, onSuccess, }: GenerateBackupCodesFormProps): react.JSX.Element;

interface ChangePasswordFormProps {
    className?: string;
    errorClassName?: string;
    title?: string;
    description?: string;
    currentPasswordLabel?: string;
    newPasswordLabel?: string;
    confirmPasswordLabel?: string;
    revokeOtherSessionsLabel?: string;
    submitLabel?: string;
    submittingLabel?: string;
    unavailableMessage?: string;
    onSuccess?: () => void;
}
/**
 * Form for changing the current user's password via Better Auth.
 */
declare function ChangePasswordForm({ className, errorClassName, title, description, currentPasswordLabel, newPasswordLabel, confirmPasswordLabel, revokeOtherSessionsLabel, submitLabel, submittingLabel, unavailableMessage, onSuccess, }: ChangePasswordFormProps): react.JSX.Element;

interface ConnectedAccountsProps {
    className?: string;
    errorClassName?: string;
    title?: string;
    description?: string;
    emptyMessage?: string;
    linkableProviders?: readonly AuthProviderOption[];
    linkLabel?: string;
    unlinkLabel?: string;
    unlinkingLabel?: string;
    unavailableMessage?: string;
    callbackURL?: string;
    errorCallbackURL?: string;
    onLinked?: () => void;
    onUnlinked?: () => void;
}
/**
 * Lists the current user's connected social accounts and allows linking/unlinking.
 */
declare function ConnectedAccounts({ className, errorClassName, title, description, emptyMessage, linkableProviders, linkLabel, unlinkLabel, unlinkingLabel, unavailableMessage, callbackURL, errorCallbackURL, onLinked, onUnlinked, }: ConnectedAccountsProps): react.JSX.Element;

interface DeleteAccountFormProps extends AuthFormBaseProps {
    title?: string;
    description?: string;
    passwordLabel?: string;
    confirmationLabel?: string;
    confirmationPlaceholder?: string;
    submitLabel?: string;
    submittingLabel?: string;
    successMessage?: string;
    unavailableMessage?: string;
    mismatchMessage?: string;
    onSuccess?: () => void;
}
/**
 * Destructive form for deleting the current account.
 *
 * Requires the user to type "delete my account" before submitting.
 */
declare function DeleteAccountForm({ title, description, className, errorClassName, passwordLabel, confirmationLabel, confirmationPlaceholder, submitLabel, submittingLabel, successMessage, unavailableMessage, mismatchMessage, onSuccess, }: DeleteAccountFormProps): react.JSX.Element;

interface SetPasswordFormProps extends AuthFormBaseProps {
    title?: string;
    description?: string;
    passwordLabel?: string;
    confirmLabel?: string;
    submitLabel?: string;
    submittingLabel?: string;
    successMessage?: string;
    unavailableMessage?: string;
}
/**
 * Form for setting a password on accounts that signed up without one
 * (e.g. via OAuth).
 */
declare function SetPasswordForm({ title, description, className, errorClassName, passwordLabel, confirmLabel, submitLabel, submittingLabel, successMessage, unavailableMessage, onSuccess, }: SetPasswordFormProps): react.JSX.Element;

interface EmailLayoutProps {
    children: ReactNode;
    previewText?: string;
    brandName?: string;
    logoUrl?: string;
    brandColor?: string;
}
declare function EmailLayout({ children, previewText, brandName, logoUrl, brandColor, }: EmailLayoutProps): react.JSX.Element;

interface VerificationEmailProps extends Omit<EmailLayoutProps, "children" | "previewText"> {
    username?: string;
    verificationUrl: string;
    previewText?: string;
    heading?: string;
    message?: string;
    buttonText?: string;
    fallbackMessage?: string;
}
declare function VerificationEmail({ username, verificationUrl, previewText, heading, message, buttonText, fallbackMessage, ...layoutProps }: VerificationEmailProps): react.JSX.Element;

interface PasswordResetEmailProps extends Omit<EmailLayoutProps, "children" | "previewText"> {
    username?: string;
    resetUrl: string;
    previewText?: string;
    heading?: string;
    message?: string;
    buttonText?: string;
    fallbackMessage?: string;
    expiryMessage?: string;
}
declare function PasswordResetEmail({ username, resetUrl, previewText, heading, message, buttonText, fallbackMessage, expiryMessage, ...layoutProps }: PasswordResetEmailProps): react.JSX.Element;

interface OrganizationInvitationEmailProps extends Omit<EmailLayoutProps, "children" | "previewText"> {
    inviterName?: string;
    organizationName: string;
    acceptUrl: string;
    previewText?: string;
    heading?: string;
    message?: string;
    buttonText?: string;
    fallbackMessage?: string;
}
declare function OrganizationInvitationEmail({ inviterName, organizationName, acceptUrl, previewText, heading, message, buttonText, fallbackMessage, ...layoutProps }: OrganizationInvitationEmailProps): react.JSX.Element;

interface ChangeEmailConfirmationProps extends Omit<EmailLayoutProps, "children" | "previewText"> {
    username?: string;
    newEmail: string;
    confirmUrl: string;
    previewText?: string;
    heading?: string;
    message?: string;
    buttonText?: string;
    fallbackMessage?: string;
}
declare function ChangeEmailConfirmation({ username, newEmail, confirmUrl, previewText, heading, message, buttonText, fallbackMessage, ...layoutProps }: ChangeEmailConfirmationProps): react.JSX.Element;

interface WelcomeEmailProps extends Omit<EmailLayoutProps, "children" | "previewText"> {
    username?: string;
    getStartedUrl: string;
    previewText?: string;
    heading?: string;
    message?: string;
    buttonText?: string;
}
declare function WelcomeEmail({ username, getStartedUrl, previewText, heading, message, buttonText, ...layoutProps }: WelcomeEmailProps): react.JSX.Element;

interface PasswordChangedEmailProps extends Omit<EmailLayoutProps, "children" | "previewText"> {
    username?: string;
    previewText?: string;
    heading?: string;
    message?: string;
    footerMessage?: string;
}
declare function PasswordChangedEmail({ username, previewText, heading, message, footerMessage, ...layoutProps }: PasswordChangedEmailProps): react.JSX.Element;

interface MagicLinkEmailProps extends Omit<EmailLayoutProps, "children" | "previewText"> {
    username?: string;
    signInUrl: string;
    previewText?: string;
    heading?: string;
    message?: string;
    buttonText?: string;
    fallbackMessage?: string;
}
declare function MagicLinkEmail({ username, signInUrl, previewText, heading, message, buttonText, fallbackMessage, ...layoutProps }: MagicLinkEmailProps): react.JSX.Element;

export { AcceptInviteScreen, type AcceptInviteScreenProps, type AnyAuthClient, AuthCard, type AuthCardProps, AuthDivider, type AuthDividerProps, AuthError, type AuthErrorProps, type AuthFormBaseProps, AuthLoading, type AuthLoadingProps, AuthProvider, AuthProviderButtons, type AuthProviderButtonsProps, type AuthProviderOption, type AuthProviderProps, AuthSubmitButton, type AuthSubmitButtonProps, type AuthUser, Authenticated, type AuthenticatedProps, ChangeEmailConfirmation, type ChangeEmailConfirmationProps, ChangeEmailForm, type ChangeEmailFormProps, ChangePasswordForm, type ChangePasswordFormProps, ConnectedAccounts, type ConnectedAccountsProps, CreateOrganizationForm, type CreateOrganizationFormProps, DeleteAccountForm, type DeleteAccountFormProps, DisableTwoFactorForm, type DisableTwoFactorFormProps, EmailLayout, type EmailLayoutProps, EnableTwoFactorForm, type EnableTwoFactorFormProps, ForgotPasswordForm, type ForgotPasswordFormProps, GenerateBackupCodesForm, type GenerateBackupCodesFormProps, InviteMemberForm, type InviteMemberFormProps, MagicLinkEmail, type MagicLinkEmailProps, MagicLinkSignInForm, type MagicLinkSignInFormProps, MagicLinkVerify, type MagicLinkVerifyProps, OrganizationInvitationEmail, type OrganizationInvitationEmailProps, OrganizationList, type OrganizationListProps, OrganizationMembers, type OrganizationMembersProps, OrganizationProfile, type OrganizationProfileProps, OrganizationSwitcher, type OrganizationSwitcherProps, PasswordChangedEmail, type PasswordChangedEmailProps, PasswordResetEmail, type PasswordResetEmailProps, ResetPasswordForm, type ResetPasswordFormProps, SessionList, type SessionListProps, SetPasswordForm, type SetPasswordFormProps, SignInForm, type SignInFormProps, SignOutButton, type SignOutButtonProps, SignUpForm, type SignUpFormProps, Unauthenticated, type UnauthenticatedProps, UserButton, type UserButtonProps, UserProfileForm, type UserProfileFormProps, VerificationEmail, type VerificationEmailProps, VerifyBackupCodeForm, type VerifyBackupCodeFormProps, VerifyEmailForm, type VerifyEmailFormProps, VerifyTotpForm, type VerifyTotpFormProps, WelcomeEmail, type WelcomeEmailProps, useAuth };
