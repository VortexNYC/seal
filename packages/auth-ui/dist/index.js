// src/auth-provider.tsx
import { createContext, useContext } from "react";
import { jsx } from "react/jsx-runtime";
var AuthContext = createContext(null);
function AuthProvider({ client, children }) {
  return /* @__PURE__ */ jsx(AuthContext.Provider, { value: client, children });
}
function useAuth() {
  const client = useContext(AuthContext);
  if (client === null) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return client;
}

// src/auth-boundaries.tsx
function Authenticated({
  children,
  fallback = null,
  loading = null
}) {
  const client = useAuth();
  const session = client.useSession();
  if (session.isPending) {
    return loading;
  }
  return session.data?.user ? children : fallback;
}
function Unauthenticated({
  children,
  fallback = null,
  loading = null
}) {
  const client = useAuth();
  const session = client.useSession();
  if (session.isPending) {
    return loading;
  }
  return session.data?.user ? fallback : children;
}
function AuthLoading({ children, fallback = null }) {
  const client = useAuth();
  const session = client.useSession();
  return session.isPending ? children : fallback;
}

// src/sign-out-button.tsx
import { Button } from "@cloudflare/kumo/components/button";
import { jsx as jsx2 } from "react/jsx-runtime";
function SignOutButton({
  redirectTo,
  onSuccess,
  onError,
  children = "Sign out",
  className,
  variant,
  size,
  loading,
  disabled
}) {
  const client = useAuth();
  async function handleClick() {
    try {
      const response = await client.signOut();
      if (response.error !== null) {
        onError?.(response.error.message ?? "Sign-out failed.");
        return;
      }
      onSuccess?.();
      if (typeof window !== "undefined" && redirectTo) {
        window.location.assign(redirectTo);
      }
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Sign-out failed.");
    }
  }
  return /* @__PURE__ */ jsx2(
    Button,
    {
      className,
      variant,
      size,
      shape: "base",
      loading,
      disabled,
      onClick: () => {
        void handleClick();
      },
      children
    }
  );
}

// src/user-button.tsx
import { useState } from "react";
import { Button as Button2 } from "@cloudflare/kumo/components/button";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { jsx as jsx3, jsxs } from "react/jsx-runtime";
function UserButton({
  className,
  redirectTo,
  onSignOut,
  onSignOutError
}) {
  const client = useAuth();
  const session = client.useSession();
  const [isSigningOut, setIsSigningOut] = useState(false);
  if (session.isPending || !session.data?.user) {
    return null;
  }
  const user = session.data.user;
  const displayName = user.name ?? user.email ?? "User";
  const initials = displayName.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      const response = await client.signOut();
      if (response.error !== null) {
        onSignOutError?.(response.error.message ?? "Sign-out failed.");
        return;
      }
      onSignOut?.();
      if (typeof window !== "undefined" && redirectTo) {
        window.location.assign(redirectTo);
      }
    } catch (err) {
      onSignOutError?.(err instanceof Error ? err.message : "Sign-out failed.");
    } finally {
      setIsSigningOut(false);
    }
  }
  return /* @__PURE__ */ jsxs(DropdownMenu, { children: [
    /* @__PURE__ */ jsx3(DropdownMenu.Trigger, { children: /* @__PURE__ */ jsxs(
      Button2,
      {
        variant: "ghost",
        shape: "base",
        className,
        loading: isSigningOut,
        "aria-label": displayName,
        children: [
          user.image ? /* @__PURE__ */ jsx3(
            "img",
            {
              src: user.image,
              alt: "",
              width: 28,
              height: 28,
              style: { borderRadius: "9999px", marginRight: "8px" }
            }
          ) : /* @__PURE__ */ jsx3(
            "span",
            {
              style: {
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "28px",
                height: "28px",
                borderRadius: "9999px",
                backgroundColor: "#0052cc",
                color: "#ffffff",
                fontSize: "12px",
                fontWeight: 600,
                marginRight: "8px"
              },
              children: initials
            }
          ),
          displayName
        ]
      }
    ) }),
    /* @__PURE__ */ jsxs(DropdownMenu.Content, { children: [
      /* @__PURE__ */ jsx3(DropdownMenu.Label, { children: user.email }),
      /* @__PURE__ */ jsx3(DropdownMenu.Separator, {}),
      /* @__PURE__ */ jsx3(
        DropdownMenu.Item,
        {
          onClick: () => {
            void handleSignOut();
          },
          children: "Sign out"
        }
      )
    ] })
  ] });
}

// src/auth-primitives.tsx
import { WarningCircle } from "@phosphor-icons/react";
import { Button as Button3 } from "@cloudflare/kumo/components/button";
import { Banner } from "@cloudflare/kumo/components/banner";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Text } from "@cloudflare/kumo/components/text";
import { jsx as jsx4, jsxs as jsxs2 } from "react/jsx-runtime";
function AuthProviderButtons({
  providers,
  onSelect,
  isSubmitting,
  className,
  providerButtonClassName
}) {
  return /* @__PURE__ */ jsx4("div", { className, children: providers.map((provider) => /* @__PURE__ */ jsx4(
    Button3,
    {
      type: "button",
      variant: "secondary",
      className: providerButtonClassName,
      disabled: isSubmitting || provider.disabled,
      icon: provider.icon,
      onClick: () => {
        void onSelect(provider.provider);
      },
      children: provider.label
    },
    provider.provider
  )) });
}
function AuthDivider({ label = "or", className }) {
  return /* @__PURE__ */ jsxs2("div", { className: `relative ${className ?? ""}`, children: [
    /* @__PURE__ */ jsx4("div", { className: "absolute inset-0 flex items-center", children: /* @__PURE__ */ jsx4("span", { className: "w-full border-t border-kumo-hairline" }) }),
    /* @__PURE__ */ jsx4("div", { className: "relative flex justify-center text-xs uppercase", children: /* @__PURE__ */ jsx4("span", { className: "bg-kumo-base px-2 text-kumo-subtle", children: label }) })
  ] });
}
function AuthCard({
  children,
  className,
  title,
  description
}) {
  return /* @__PURE__ */ jsxs2(LayerCard, { className, children: [
    /* @__PURE__ */ jsxs2(LayerCard.Secondary, { children: [
      /* @__PURE__ */ jsx4(Text, { as: "h1", variant: "heading", children: title }),
      description ? /* @__PURE__ */ jsx4(Text, { variant: "secondary", children: description }) : null
    ] }),
    /* @__PURE__ */ jsx4(LayerCard.Primary, { children })
  ] });
}
function AuthError({ message, className }) {
  if (!message) return null;
  return /* @__PURE__ */ jsx4(
    Banner,
    {
      className,
      variant: "error",
      icon: /* @__PURE__ */ jsx4(WarningCircle, { weight: "fill" }),
      title: "Error",
      description: message
    }
  );
}
function AuthSubmitButton({
  loading,
  children,
  ...props
}) {
  return /* @__PURE__ */ jsx4(Button3, { type: "submit", variant: "primary", loading, ...props, children });
}

// src/forms/sign-in-form.tsx
import { useState as useState2 } from "react";
import { Input } from "@cloudflare/kumo/components/input";
import { Link } from "@cloudflare/kumo/components/link";
import { z } from "zod";
import { Fragment, jsx as jsx5, jsxs as jsxs3 } from "react/jsx-runtime";
var signInSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required")
});
function SignInForm({
  title = "Sign in",
  description = "Access your workspace.",
  redirectTo,
  forgotPasswordHref,
  signUpUrl,
  className,
  errorClassName,
  submitLabel = "Sign in",
  submittingLabel = "Signing in...",
  providers,
  onProviderSelect,
  dividerLabel = "or",
  onSuccess
}) {
  const client = useAuth();
  const [email, setEmail] = useState2("");
  const [password, setPassword] = useState2("");
  const [isSubmitting, setIsSubmitting] = useState2(false);
  const [error, setError] = useState2(null);
  const [fieldErrors, setFieldErrors] = useState2({});
  async function handleProviderSelect(providerId) {
    if (onProviderSelect) {
      await onProviderSelect(providerId);
      return;
    }
    setError(null);
    if (client.signIn.social === void 0) {
      setError("Social sign-in is not available.");
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await client.signIn.social({
        provider: providerId,
        callbackURL: redirectTo
      });
      if (response.error !== null) {
        setError(response.error.message ?? "Social sign-in failed.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Social sign-in failed.");
    } finally {
      setIsSubmitting(false);
    }
  }
  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    const validation = signInSchema.safeParse({ email, password });
    if (!validation.success) {
      const flattened = validation.error.flatten().fieldErrors;
      setFieldErrors({
        email: flattened.email?.[0],
        password: flattened.password?.[0]
      });
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await client.signIn.email({
        email: validation.data.email,
        password: validation.data.password,
        callbackURL: redirectTo
      });
      if (response.error !== null) {
        setError(response.error.message ?? "Sign-in failed.");
        return;
      }
      if (typeof response.data === "object" && response.data !== null && "twoFactorRedirect" in response.data && response.data.twoFactorRedirect === true) {
        setError("Two-factor authentication required.");
        return;
      }
      onSuccess?.();
      if (typeof window !== "undefined" && redirectTo) {
        window.location.assign(redirectTo);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setIsSubmitting(false);
    }
  }
  return /* @__PURE__ */ jsx5(AuthCard, { className, title, description, children: /* @__PURE__ */ jsxs3("form", { onSubmit: handleSubmit, className: "space-y-4", children: [
    /* @__PURE__ */ jsx5(AuthError, { message: error, className: errorClassName }),
    providers !== void 0 && providers.length > 0 ? /* @__PURE__ */ jsxs3(Fragment, { children: [
      /* @__PURE__ */ jsx5(
        AuthProviderButtons,
        {
          providers,
          onSelect: handleProviderSelect,
          isSubmitting,
          className: "space-y-2",
          providerButtonClassName: "w-full"
        }
      ),
      /* @__PURE__ */ jsx5(AuthDivider, { label: dividerLabel })
    ] }) : null,
    /* @__PURE__ */ jsx5(
      Input,
      {
        label: "Email",
        type: "email",
        value: email,
        onValueChange: setEmail,
        error: fieldErrors.email,
        autoComplete: "email",
        required: true
      }
    ),
    /* @__PURE__ */ jsx5(
      Input,
      {
        label: "Password",
        type: "password",
        value: password,
        onValueChange: setPassword,
        error: fieldErrors.password,
        autoComplete: "current-password",
        required: true
      }
    ),
    forgotPasswordHref ? /* @__PURE__ */ jsx5("div", { className: "flex justify-end", children: /* @__PURE__ */ jsx5(Link, { href: forgotPasswordHref, variant: "plain", className: "text-sm", children: "Forgot password?" }) }) : null,
    /* @__PURE__ */ jsx5(AuthSubmitButton, { loading: isSubmitting, className: "w-full", children: isSubmitting ? submittingLabel : submitLabel }),
    signUpUrl ? /* @__PURE__ */ jsxs3("p", { className: "text-center text-sm text-kumo-subtle", children: [
      "Don't have an account?",
      " ",
      /* @__PURE__ */ jsx5(Link, { href: signUpUrl, variant: "inline", children: "Sign up" })
    ] }) : null
  ] }) });
}

// src/forms/sign-up-form.tsx
import { useState as useState3 } from "react";
import { Input as Input2 } from "@cloudflare/kumo/components/input";
import { Link as Link2 } from "@cloudflare/kumo/components/link";
import { z as z2 } from "zod";
import { Fragment as Fragment2, jsx as jsx6, jsxs as jsxs4 } from "react/jsx-runtime";
var signUpSchema = z2.object({
  name: z2.string().min(1, "Name is required"),
  email: z2.string().email("Please enter a valid email address"),
  password: z2.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z2.string().min(1, "Confirm password is required")
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"]
});
function SignUpForm({
  title = "Create account",
  description = "Get started with your workspace.",
  redirectTo,
  signInUrl,
  className,
  errorClassName,
  submitLabel = "Create account",
  submittingLabel = "Creating account...",
  providers,
  onProviderSelect,
  dividerLabel = "or",
  onSuccess
}) {
  const client = useAuth();
  const [name, setName] = useState3("");
  const [email, setEmail] = useState3("");
  const [password, setPassword] = useState3("");
  const [confirmPassword, setConfirmPassword] = useState3("");
  const [isSubmitting, setIsSubmitting] = useState3(false);
  const [error, setError] = useState3(null);
  const [fieldErrors, setFieldErrors] = useState3({});
  async function handleProviderSelect(providerId) {
    if (onProviderSelect) {
      await onProviderSelect(providerId);
      return;
    }
    setError(null);
    if (client.signIn.social === void 0) {
      setError("Social sign-up is not available.");
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await client.signIn.social({
        provider: providerId,
        callbackURL: redirectTo
      });
      if (response.error !== null) {
        setError(response.error.message ?? "Social sign-up failed.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Social sign-up failed.");
    } finally {
      setIsSubmitting(false);
    }
  }
  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    const validation = signUpSchema.safeParse({
      name,
      email,
      password,
      confirmPassword
    });
    if (!validation.success) {
      const flattened = validation.error.flatten().fieldErrors;
      setFieldErrors({
        name: flattened.name?.[0],
        email: flattened.email?.[0],
        password: flattened.password?.[0],
        confirmPassword: flattened.confirmPassword?.[0]
      });
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await client.signUp.email({
        name: validation.data.name,
        email: validation.data.email,
        password: validation.data.password,
        callbackURL: redirectTo
      });
      if (response.error !== null) {
        setError(response.error.message ?? "Sign-up failed.");
        return;
      }
      onSuccess?.();
      if (typeof window !== "undefined" && redirectTo) {
        window.location.assign(redirectTo);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-up failed.");
    } finally {
      setIsSubmitting(false);
    }
  }
  return /* @__PURE__ */ jsx6(AuthCard, { className, title, description, children: /* @__PURE__ */ jsxs4("form", { onSubmit: handleSubmit, className: "space-y-4", children: [
    /* @__PURE__ */ jsx6(AuthError, { message: error, className: errorClassName }),
    providers !== void 0 && providers.length > 0 ? /* @__PURE__ */ jsxs4(Fragment2, { children: [
      /* @__PURE__ */ jsx6(
        AuthProviderButtons,
        {
          providers,
          onSelect: handleProviderSelect,
          isSubmitting,
          className: "space-y-2",
          providerButtonClassName: "w-full"
        }
      ),
      /* @__PURE__ */ jsx6(AuthDivider, { label: dividerLabel })
    ] }) : null,
    /* @__PURE__ */ jsx6(
      Input2,
      {
        label: "Name",
        type: "text",
        value: name,
        onValueChange: setName,
        error: fieldErrors.name,
        autoComplete: "name",
        required: true
      }
    ),
    /* @__PURE__ */ jsx6(
      Input2,
      {
        label: "Email",
        type: "email",
        value: email,
        onValueChange: setEmail,
        error: fieldErrors.email,
        autoComplete: "email",
        required: true
      }
    ),
    /* @__PURE__ */ jsx6(
      Input2,
      {
        label: "Password",
        type: "password",
        value: password,
        onValueChange: setPassword,
        error: fieldErrors.password,
        autoComplete: "new-password",
        required: true
      }
    ),
    /* @__PURE__ */ jsx6(
      Input2,
      {
        label: "Confirm password",
        type: "password",
        value: confirmPassword,
        onValueChange: setConfirmPassword,
        error: fieldErrors.confirmPassword,
        autoComplete: "new-password",
        required: true
      }
    ),
    /* @__PURE__ */ jsx6(AuthSubmitButton, { loading: isSubmitting, className: "w-full", children: isSubmitting ? submittingLabel : submitLabel }),
    signInUrl ? /* @__PURE__ */ jsxs4("p", { className: "text-center text-sm text-kumo-subtle", children: [
      "Already have an account?",
      " ",
      /* @__PURE__ */ jsx6(Link2, { href: signInUrl, variant: "inline", children: "Sign in" })
    ] }) : null
  ] }) });
}

// src/forms/magic-link-sign-in-form.tsx
import { useState as useState4 } from "react";
import { Input as Input3 } from "@cloudflare/kumo/components/input";
import { z as z3 } from "zod";
import { jsx as jsx7, jsxs as jsxs5 } from "react/jsx-runtime";
var magicLinkSchema = z3.object({
  email: z3.string().email("Please enter a valid email address")
});
function MagicLinkSignInForm({
  redirectTo,
  title = "Sign in with magic link",
  description = "Enter your email and we'll send you a sign-in link.",
  className,
  errorClassName,
  emailLabel = "Email",
  submitLabel = "Send magic link",
  submittingLabel = "Sending\u2026",
  successMessage = "Check your email for a sign-in link.",
  unavailableMessage = "Magic link sign-in is not available."
}) {
  const client = useAuth();
  const [email, setEmail] = useState4("");
  const [isSubmitting, setIsSubmitting] = useState4(false);
  const [error, setError] = useState4(null);
  const [success, setSuccess] = useState4(false);
  const [fieldErrors, setFieldErrors] = useState4({});
  if (client.signIn?.magicLink === void 0) {
    return /* @__PURE__ */ jsx7(AuthCard, { className, title, description, children: /* @__PURE__ */ jsx7(AuthError, { message: unavailableMessage, className: errorClassName }) });
  }
  const signInMagicLink = client.signIn.magicLink;
  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    setFieldErrors({});
    const validation = magicLinkSchema.safeParse({ email });
    if (!validation.success) {
      const flattened = validation.error.flatten().fieldErrors;
      setFieldErrors({ email: flattened.email?.[0] });
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await signInMagicLink({
        email: validation.data.email,
        callbackURL: redirectTo
      });
      if (response.error !== null) {
        setError(response.error.message ?? "Could not send magic link.");
        return;
      }
      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not send magic link."
      );
    } finally {
      setIsSubmitting(false);
    }
  }
  if (success) {
    return /* @__PURE__ */ jsx7(AuthCard, { className, title, description, children: /* @__PURE__ */ jsx7("p", { className: "text-center text-sm text-kumo-subtle", children: successMessage }) });
  }
  return /* @__PURE__ */ jsx7(AuthCard, { className, title, description, children: /* @__PURE__ */ jsxs5("form", { onSubmit: handleSubmit, className: "space-y-4", children: [
    /* @__PURE__ */ jsx7(AuthError, { message: error, className: errorClassName }),
    /* @__PURE__ */ jsx7(
      Input3,
      {
        label: emailLabel,
        type: "email",
        value: email,
        onValueChange: setEmail,
        error: fieldErrors.email,
        autoComplete: "email",
        required: true
      }
    ),
    /* @__PURE__ */ jsx7(
      AuthSubmitButton,
      {
        loading: isSubmitting,
        className: "w-full",
        shape: "base",
        children: isSubmitting ? submittingLabel : submitLabel
      }
    )
  ] }) });
}

// src/forms/magic-link-verify.tsx
import { useEffect, useState as useState5 } from "react";
import { jsx as jsx8, jsxs as jsxs6 } from "react/jsx-runtime";
function MagicLinkVerify({
  token,
  callbackURL,
  title = "Sign in",
  description = "Verifying your magic link\u2026",
  className,
  errorClassName,
  verifyingMessage = "Verifying your magic link\u2026",
  verifiedMessage = "You are signed in.",
  missingTokenMessage = "This sign-in link is missing or invalid.",
  unavailableMessage = "Magic link verification is not available.",
  onSuccess
}) {
  const client = useAuth();
  const resolvedMissingMessage = missingTokenMessage ?? "This sign-in link is missing or invalid.";
  const resolvedUnavailableMessage = unavailableMessage ?? "Magic link verification is not available.";
  const [status, setStatus] = useState5(
    token ? "verifying" : "error"
  );
  const [error, setError] = useState5(
    token ? null : resolvedMissingMessage
  );
  useEffect(() => {
    if (!token) {
      setStatus("error");
      setError(resolvedMissingMessage);
      return;
    }
    if (client.magicLink?.verify === void 0) {
      setStatus("error");
      setError(resolvedUnavailableMessage);
      return;
    }
    const verificationToken = token;
    let cancelled = false;
    async function verify() {
      const response = await client.magicLink.verify({
        token: verificationToken,
        callbackURL
      });
      if (cancelled) return;
      if (response.error !== null) {
        setStatus("error");
        setError(response.error.message ?? "Sign-in failed.");
        return;
      }
      setStatus("verified");
      onSuccess?.();
      if (typeof window !== "undefined" && callbackURL) {
        window.location.assign(callbackURL);
      }
    }
    verify().catch((err) => {
      if (cancelled) return;
      setStatus("error");
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    });
    return () => {
      cancelled = true;
    };
  }, [
    token,
    callbackURL,
    client,
    onSuccess,
    resolvedMissingMessage,
    resolvedUnavailableMessage
  ]);
  return /* @__PURE__ */ jsx8(AuthCard, { className, title, description, children: /* @__PURE__ */ jsxs6("div", { className: "space-y-4", children: [
    /* @__PURE__ */ jsx8(AuthError, { message: error, className: errorClassName }),
    status === "verifying" ? /* @__PURE__ */ jsx8("p", { className: "text-center text-sm text-kumo-subtle", children: verifyingMessage }) : null,
    status === "verified" ? /* @__PURE__ */ jsx8("p", { className: "text-center text-sm text-kumo-subtle", children: verifiedMessage }) : null
  ] }) });
}

// src/forms/forgot-password-form.tsx
import { useState as useState6 } from "react";
import { Input as Input4 } from "@cloudflare/kumo/components/input";
import { Link as Link3 } from "@cloudflare/kumo/components/link";
import { z as z4 } from "zod";
import { Fragment as Fragment3, jsx as jsx9, jsxs as jsxs7 } from "react/jsx-runtime";
var forgotPasswordSchema = z4.object({
  email: z4.string().email("Please enter a valid email address")
});
function ForgotPasswordForm({
  title = "Forgot password",
  description = "Enter your email and we'll send you a reset link.",
  resetPasswordUrl,
  signInUrl,
  className,
  errorClassName,
  submitLabel = "Send reset link",
  submittingLabel = "Sending...",
  successMessage = "Check your email for a reset link.",
  onSuccess
}) {
  const client = useAuth();
  const [email, setEmail] = useState6("");
  const [isSubmitting, setIsSubmitting] = useState6(false);
  const [error, setError] = useState6(null);
  const [fieldErrors, setFieldErrors] = useState6(
    {}
  );
  const [success, setSuccess] = useState6(false);
  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setSuccess(false);
    const validation = forgotPasswordSchema.safeParse({ email });
    if (!validation.success) {
      const flattened = validation.error.flatten().fieldErrors;
      setFieldErrors({ email: flattened.email?.[0] });
      return;
    }
    setIsSubmitting(true);
    if (client.forgetPassword === void 0) {
      setError("Password recovery is not available.");
      setIsSubmitting(false);
      return;
    }
    try {
      const response = await client.forgetPassword({
        email: validation.data.email,
        redirectTo: resetPasswordUrl
      });
      if (response.error !== null) {
        setError(response.error.message ?? "Request failed.");
        return;
      }
      setSuccess(true);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setIsSubmitting(false);
    }
  }
  return /* @__PURE__ */ jsx9(AuthCard, { className, title, description, children: /* @__PURE__ */ jsxs7("form", { onSubmit: handleSubmit, className: "space-y-4", children: [
    /* @__PURE__ */ jsx9(AuthError, { message: error, className: errorClassName }),
    success ? /* @__PURE__ */ jsx9("p", { className: "text-center text-sm text-kumo-subtle", children: successMessage }) : /* @__PURE__ */ jsxs7(Fragment3, { children: [
      /* @__PURE__ */ jsx9(
        Input4,
        {
          label: "Email",
          type: "email",
          value: email,
          onValueChange: setEmail,
          error: fieldErrors.email,
          autoComplete: "email",
          required: true
        }
      ),
      /* @__PURE__ */ jsx9(AuthSubmitButton, { loading: isSubmitting, className: "w-full", children: isSubmitting ? submittingLabel : submitLabel })
    ] }),
    signInUrl ? /* @__PURE__ */ jsxs7("p", { className: "text-center text-sm text-kumo-subtle", children: [
      "Remember your password?",
      " ",
      /* @__PURE__ */ jsx9(Link3, { href: signInUrl, variant: "inline", children: "Sign in" })
    ] }) : null
  ] }) });
}

// src/forms/reset-password-form.tsx
import { useState as useState7 } from "react";
import { Input as Input5 } from "@cloudflare/kumo/components/input";
import { z as z5 } from "zod";
import { Fragment as Fragment4, jsx as jsx10, jsxs as jsxs8 } from "react/jsx-runtime";
var resetPasswordSchema = z5.object({
  password: z5.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z5.string().min(1, "Confirm password is required")
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"]
});
function ResetPasswordForm({
  token,
  title = "Reset password",
  description = "Choose a new password for your account.",
  className,
  errorClassName,
  submitLabel = "Reset password",
  submittingLabel = "Resetting...",
  successMessage = "Password updated. You can now sign in.",
  onSuccess
}) {
  const client = useAuth();
  const [password, setPassword] = useState7("");
  const [confirmPassword, setConfirmPassword] = useState7("");
  const [isSubmitting, setIsSubmitting] = useState7(false);
  const [error, setError] = useState7(null);
  const [fieldErrors, setFieldErrors] = useState7(
    {}
  );
  const [success, setSuccess] = useState7(false);
  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setSuccess(false);
    const validation = resetPasswordSchema.safeParse({
      password,
      confirmPassword
    });
    if (!validation.success) {
      const flattened = validation.error.flatten().fieldErrors;
      setFieldErrors({
        password: flattened.password?.[0],
        confirmPassword: flattened.confirmPassword?.[0]
      });
      return;
    }
    if (client.resetPassword === void 0) {
      setError("Password reset is not available.");
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await client.resetPassword({
        newPassword: validation.data.password,
        token
      });
      if (response.error !== null) {
        setError(response.error.message ?? "Password reset failed.");
        return;
      }
      setSuccess(true);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Password reset failed.");
    } finally {
      setIsSubmitting(false);
    }
  }
  return /* @__PURE__ */ jsx10(AuthCard, { className, title, description, children: /* @__PURE__ */ jsxs8("form", { onSubmit: handleSubmit, className: "space-y-4", children: [
    /* @__PURE__ */ jsx10(AuthError, { message: error, className: errorClassName }),
    success ? /* @__PURE__ */ jsx10("p", { className: "text-center text-sm text-kumo-subtle", children: successMessage }) : /* @__PURE__ */ jsxs8(Fragment4, { children: [
      /* @__PURE__ */ jsx10(
        Input5,
        {
          label: "New password",
          type: "password",
          value: password,
          onValueChange: setPassword,
          error: fieldErrors.password,
          autoComplete: "new-password",
          required: true
        }
      ),
      /* @__PURE__ */ jsx10(
        Input5,
        {
          label: "Confirm password",
          type: "password",
          value: confirmPassword,
          onValueChange: setConfirmPassword,
          error: fieldErrors.confirmPassword,
          autoComplete: "new-password",
          required: true
        }
      ),
      /* @__PURE__ */ jsx10(AuthSubmitButton, { loading: isSubmitting, className: "w-full", children: isSubmitting ? submittingLabel : submitLabel })
    ] })
  ] }) });
}

// src/forms/verify-email-form.tsx
import { useEffect as useEffect2, useState as useState8 } from "react";
import { Input as Input6 } from "@cloudflare/kumo/components/input";
import { z as z6 } from "zod";
import { Fragment as Fragment5, jsx as jsx11, jsxs as jsxs9 } from "react/jsx-runtime";
var sendEmailSchema = z6.object({
  email: z6.string().email("Please enter a valid email address")
});
function VerifyEmailForm({
  token,
  userEmail,
  callbackUrl,
  title = "Verify your email",
  description = "Confirm your email address to continue.",
  className,
  errorClassName,
  verifiedMessage = "Your email has been verified.",
  sendLabel = "Send verification email",
  sendingLabel = "Sending...",
  onSuccess
}) {
  const client = useAuth();
  const [status, setStatus] = useState8(
    token ? "verifying" : "idle"
  );
  const [error, setError] = useState8(null);
  const [email, setEmail] = useState8(userEmail ?? "");
  const [isSending, setIsSending] = useState8(false);
  const [sendError, setSendError] = useState8(null);
  const [sendSuccess, setSendSuccess] = useState8(false);
  const [fieldErrors, setFieldErrors] = useState8({});
  useEffect2(() => {
    if (!token) {
      return;
    }
    if (client.verifyEmail === void 0) {
      setStatus("error");
      setError("Email verification is not available.");
      return;
    }
    const verificationToken = token;
    let cancelled = false;
    async function verify() {
      const response = await client.verifyEmail({
        query: { token: verificationToken }
      });
      if (cancelled) return;
      if (response.error !== null) {
        setStatus("error");
        setError(response.error.message ?? "Verification failed.");
        return;
      }
      setStatus("verified");
      onSuccess?.();
    }
    verify().catch((err) => {
      if (cancelled) return;
      setStatus("error");
      setError(err instanceof Error ? err.message : "Verification failed.");
    });
    return () => {
      cancelled = true;
    };
  }, [token, client, onSuccess]);
  async function handleSend(event) {
    event.preventDefault();
    setSendError(null);
    setSendSuccess(false);
    setFieldErrors({});
    const validation = sendEmailSchema.safeParse({ email });
    if (!validation.success) {
      const flattened = validation.error.flatten().fieldErrors;
      setFieldErrors({ email: flattened.email?.[0] });
      return;
    }
    if (client.sendVerificationEmail === void 0) {
      setSendError("Sending verification email is not available.");
      return;
    }
    setIsSending(true);
    try {
      const response = await client.sendVerificationEmail({
        email: validation.data.email,
        callbackURL: callbackUrl
      });
      if (response.error !== null) {
        setSendError(response.error.message ?? "Could not send email.");
        return;
      }
      setSendSuccess(true);
    } catch (err) {
      setSendError(
        err instanceof Error ? err.message : "Could not send email."
      );
    } finally {
      setIsSending(false);
    }
  }
  return /* @__PURE__ */ jsx11(AuthCard, { className, title, description, children: /* @__PURE__ */ jsxs9("div", { className: "space-y-4", children: [
    /* @__PURE__ */ jsx11(AuthError, { message: error, className: errorClassName }),
    status === "verifying" ? /* @__PURE__ */ jsx11("p", { className: "text-center text-sm text-kumo-subtle", children: "Verifying your email\u2026" }) : null,
    status === "verified" ? /* @__PURE__ */ jsx11("p", { className: "text-center text-sm text-kumo-subtle", children: verifiedMessage }) : null,
    status === "error" || !token ? /* @__PURE__ */ jsxs9("form", { onSubmit: handleSend, className: "space-y-4", children: [
      /* @__PURE__ */ jsx11(AuthError, { message: sendError, className: errorClassName }),
      sendSuccess ? /* @__PURE__ */ jsx11("p", { className: "text-center text-sm text-kumo-subtle", children: "Check your inbox for a new verification link." }) : /* @__PURE__ */ jsxs9(Fragment5, { children: [
        /* @__PURE__ */ jsx11(
          Input6,
          {
            label: "Email",
            type: "email",
            value: email,
            onValueChange: setEmail,
            error: fieldErrors.email,
            autoComplete: "email",
            required: true
          }
        ),
        /* @__PURE__ */ jsx11(AuthSubmitButton, { loading: isSending, className: "w-full", children: isSending ? sendingLabel : sendLabel })
      ] })
    ] }) : null
  ] }) });
}

// src/forms/enable-two-factor-form.tsx
import { useMemo, useState as useState9 } from "react";
import { Input as Input7 } from "@cloudflare/kumo/components/input";
import { Text as Text2 } from "@cloudflare/kumo/components/text";

// src/lib/totp.ts
function extractTotpSecret(totpURI) {
  try {
    const url = new URL(totpURI);
    return url.searchParams.get("secret");
  } catch {
    const match = totpURI.match(/[?&]secret=([^&]+)/i);
    const secret = match?.[1];
    return secret === void 0 ? null : decodeURIComponent(secret);
  }
}

// src/forms/enable-two-factor-form.tsx
import { jsx as jsx12, jsxs as jsxs10 } from "react/jsx-runtime";
function EnableTwoFactorForm({
  issuer,
  qrCode,
  title = "Enable two-factor authentication",
  description = "Add an authenticator app for an extra layer of security.",
  className,
  errorClassName,
  passwordLabel = "Confirm your password",
  codeLabel = "6-digit code",
  secretLabel = "Setup key",
  verifyTitle = "Scan the QR code",
  verifyDescription = "Scan the code with your authenticator app, or enter the setup key manually, then enter the 6-digit code.",
  backupTitle = "Save your backup codes",
  backupDescription = "Store these somewhere safe. Each code works once if you lose access to your authenticator. They won't be shown again.",
  submitLabel = "Continue",
  verifyLabel = "Verify & enable",
  doneLabel = "Done",
  submittingLabel = "Working\u2026",
  verifyingLabel = "Verifying\u2026",
  unavailableMessage = "Two-factor authentication is not available.",
  onSuccess
}) {
  const client = useAuth();
  const isAvailable = client.twoFactor?.enable !== void 0;
  const [step, setStep] = useState9("password");
  const [password, setPassword] = useState9("");
  const [code, setCode] = useState9("");
  const [totpURI, setTotpURI] = useState9(null);
  const [backupCodes, setBackupCodes] = useState9([]);
  const [error, setError] = useState9(null);
  const [isSubmitting, setIsSubmitting] = useState9(false);
  const secret = useMemo(
    () => totpURI === null ? null : extractTotpSecret(totpURI),
    [totpURI]
  );
  const header = useMemo(() => {
    if (step === "backup") {
      return { title: backupTitle, description: backupDescription };
    }
    if (step === "verify") {
      return { title: verifyTitle, description: verifyDescription };
    }
    return { title, description };
  }, [
    step,
    title,
    description,
    verifyTitle,
    verifyDescription,
    backupTitle,
    backupDescription
  ]);
  async function handleEnable(event) {
    event.preventDefault();
    setError(null);
    if (password.length === 0) {
      setError("Password is required.");
      return;
    }
    if (client.twoFactor?.enable === void 0) {
      setError(unavailableMessage);
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await client.twoFactor.enable({ password, issuer });
      if (response.error !== null) {
        setError(response.error.message ?? "Could not enable two-factor.");
        return;
      }
      setTotpURI(response.data?.totpURI ?? null);
      setBackupCodes(response.data?.backupCodes ?? []);
      setStep("verify");
      setPassword("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not enable two-factor."
      );
    } finally {
      setIsSubmitting(false);
    }
  }
  async function handleVerify(event) {
    event.preventDefault();
    setError(null);
    const trimmed = code.trim();
    if (trimmed.length === 0) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    if (client.twoFactor?.verifyTotp === void 0) {
      setError(unavailableMessage);
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await client.twoFactor.verifyTotp({ code: trimmed });
      if (response.error !== null) {
        setError(response.error.message ?? "Invalid code.");
        return;
      }
      setStep("backup");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code.");
    } finally {
      setIsSubmitting(false);
    }
  }
  if (!isAvailable) {
    return /* @__PURE__ */ jsx12(AuthCard, { className, title, description, children: /* @__PURE__ */ jsx12(AuthError, { message: unavailableMessage, className: errorClassName }) });
  }
  return /* @__PURE__ */ jsx12(
    AuthCard,
    {
      className,
      title: header.title,
      description: header.description,
      children: /* @__PURE__ */ jsxs10("div", { className: "space-y-4", children: [
        /* @__PURE__ */ jsx12(AuthError, { message: error, className: errorClassName }),
        step === "password" ? /* @__PURE__ */ jsxs10("form", { onSubmit: handleEnable, className: "space-y-4", children: [
          /* @__PURE__ */ jsx12(
            Input7,
            {
              label: passwordLabel,
              type: "password",
              value: password,
              onValueChange: setPassword,
              autoComplete: "current-password",
              required: true
            }
          ),
          /* @__PURE__ */ jsx12(AuthSubmitButton, { loading: isSubmitting, className: "w-full", children: isSubmitting ? submittingLabel : submitLabel })
        ] }) : null,
        step === "verify" ? /* @__PURE__ */ jsxs10("form", { onSubmit: handleVerify, className: "space-y-4", children: [
          totpURI !== null && qrCode !== void 0 ? /* @__PURE__ */ jsx12("div", { className: "flex justify-center", children: qrCode(totpURI) }) : null,
          secret !== null ? /* @__PURE__ */ jsx12(
            Input7,
            {
              label: secretLabel,
              value: secret,
              readOnly: true,
              onValueChange: () => {
              }
            }
          ) : null,
          /* @__PURE__ */ jsx12(
            Input7,
            {
              label: codeLabel,
              type: "text",
              inputMode: "numeric",
              autoComplete: "one-time-code",
              value: code,
              onValueChange: setCode,
              required: true
            }
          ),
          /* @__PURE__ */ jsx12(AuthSubmitButton, { loading: isSubmitting, className: "w-full", children: isSubmitting ? verifyingLabel : verifyLabel })
        ] }) : null,
        step === "backup" ? /* @__PURE__ */ jsxs10("div", { className: "space-y-4", children: [
          /* @__PURE__ */ jsx12("ul", { className: "grid grid-cols-2 gap-2", children: backupCodes.map((backupCode) => /* @__PURE__ */ jsx12("li", { children: /* @__PURE__ */ jsx12(
            Text2,
            {
              as: "code",
              variant: "mono",
              DANGEROUS_className: "break-all",
              children: backupCode
            }
          ) }, backupCode)) }),
          /* @__PURE__ */ jsx12(
            AuthSubmitButton,
            {
              type: "button",
              className: "w-full",
              onClick: () => onSuccess?.(),
              children: doneLabel
            }
          )
        ] }) : null
      ] })
    }
  );
}

// src/forms/verify-totp-form.tsx
import { useState as useState10 } from "react";
import { Input as Input8 } from "@cloudflare/kumo/components/input";
import { jsx as jsx13, jsxs as jsxs11 } from "react/jsx-runtime";
function VerifyTotpForm({
  title = "Two-factor authentication",
  description = "Enter the 6-digit code from your authenticator app.",
  className,
  errorClassName,
  submitLabel = "Verify",
  submittingLabel = "Verifying\u2026",
  unavailableMessage = "Two-factor authentication is not available.",
  showTrustDevice = false,
  trustDeviceLabel = "Trust this device",
  onSuccess
}) {
  const client = useAuth();
  const [code, setCode] = useState10("");
  const [trustDevice, setTrustDevice] = useState10(false);
  const [error, setError] = useState10(null);
  const [isSubmitting, setIsSubmitting] = useState10(false);
  const isAvailable = client.twoFactor?.verifyTotp !== void 0;
  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    const trimmed = code.trim();
    if (trimmed.length === 0) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    if (client.twoFactor?.verifyTotp === void 0) {
      setError(unavailableMessage);
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await client.twoFactor.verifyTotp({
        code: trimmed,
        trustDevice
      });
      if (response.error !== null) {
        setError(response.error.message ?? "Invalid code.");
        return;
      }
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code.");
    } finally {
      setIsSubmitting(false);
    }
  }
  if (!isAvailable) {
    return /* @__PURE__ */ jsx13(AuthCard, { className, title, description, children: /* @__PURE__ */ jsx13(AuthError, { message: unavailableMessage, className: errorClassName }) });
  }
  return /* @__PURE__ */ jsx13(AuthCard, { className, title, description, children: /* @__PURE__ */ jsxs11("form", { onSubmit: handleSubmit, className: "space-y-4", children: [
    /* @__PURE__ */ jsx13(AuthError, { message: error, className: errorClassName }),
    /* @__PURE__ */ jsx13(
      Input8,
      {
        label: "6-digit code",
        type: "text",
        inputMode: "numeric",
        autoComplete: "one-time-code",
        value: code,
        onValueChange: setCode,
        required: true
      }
    ),
    showTrustDevice ? /* @__PURE__ */ jsxs11("label", { className: "flex items-center gap-2 text-sm", children: [
      /* @__PURE__ */ jsx13(
        "input",
        {
          type: "checkbox",
          checked: trustDevice,
          onChange: (event) => setTrustDevice(event.target.checked)
        }
      ),
      trustDeviceLabel
    ] }) : null,
    /* @__PURE__ */ jsx13(AuthSubmitButton, { loading: isSubmitting, className: "w-full", children: isSubmitting ? submittingLabel : submitLabel })
  ] }) });
}

// src/forms/session-list.tsx
import { useEffect as useEffect3, useState as useState11 } from "react";
import { Button as Button4 } from "@cloudflare/kumo/components/button";
import { Text as Text3 } from "@cloudflare/kumo/components/text";
import { jsx as jsx14, jsxs as jsxs12 } from "react/jsx-runtime";
function defaultFormatTimestamp(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}
function SessionList({
  title = "Active sessions",
  description = "Devices currently signed in to this account.",
  className,
  errorClassName,
  currentSessionToken,
  showRevokeOthersAction = true,
  loadingLabel = "Loading sessions\u2026",
  emptyLabel = "No active sessions found.",
  revokeLabel = "Revoke",
  revokingLabel = "Revoking\u2026",
  revokeOthersLabel = "Revoke other sessions",
  revokingOthersLabel = "Revoking\u2026",
  currentBadgeLabel = "Current",
  lastActivePrefix = "Last active",
  formatTimestamp = defaultFormatTimestamp,
  onRevoke
}) {
  const client = useAuth();
  const [sessions, setSessions] = useState11(null);
  const [isLoading, setIsLoading] = useState11(true);
  const [error, setError] = useState11(null);
  const [revokingToken, setRevokingToken] = useState11(null);
  const [isRevokingOthers, setIsRevokingOthers] = useState11(false);
  async function load() {
    setError(null);
    if (client.listSessions === void 0) {
      setError("Session listing is not available.");
      setIsLoading(false);
      return;
    }
    try {
      const response = await client.listSessions();
      if (response.error !== null) {
        setError(response.error.message ?? "Could not load sessions.");
        return;
      }
      const data = Array.isArray(response.data) ? response.data : [];
      setSessions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load sessions.");
    } finally {
      setIsLoading(false);
    }
  }
  useEffect3(() => {
    void load();
  }, [client]);
  const otherSessionCount = sessions?.filter((session) => session.token !== currentSessionToken).length ?? 0;
  async function handleRevoke(session) {
    if (client.revokeSession === void 0) {
      setError("Session revocation is not available.");
      return;
    }
    setRevokingToken(session.token);
    setError(null);
    try {
      const response = await client.revokeSession({ token: session.token });
      if (response.error !== null) {
        setError(response.error.message ?? "Could not revoke session.");
        return;
      }
      onRevoke?.();
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not revoke session."
      );
    } finally {
      setRevokingToken(null);
    }
  }
  async function handleRevokeOthers() {
    if (client.revokeOtherSessions === void 0) {
      setError("Revoking other sessions is not available.");
      return;
    }
    setIsRevokingOthers(true);
    setError(null);
    try {
      const response = await client.revokeOtherSessions();
      if (response.error !== null) {
        setError(response.error.message ?? "Could not revoke other sessions.");
        return;
      }
      onRevoke?.();
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not revoke other sessions."
      );
    } finally {
      setIsRevokingOthers(false);
    }
  }
  return /* @__PURE__ */ jsx14(AuthCard, { className, title, description, children: /* @__PURE__ */ jsxs12("div", { className: "space-y-4", children: [
    /* @__PURE__ */ jsx14(AuthError, { message: error, className: errorClassName }),
    showRevokeOthersAction && otherSessionCount > 0 ? /* @__PURE__ */ jsx14(
      Button4,
      {
        type: "button",
        variant: "secondary",
        onClick: () => void handleRevokeOthers(),
        loading: isRevokingOthers,
        children: isRevokingOthers ? revokingOthersLabel : revokeOthersLabel
      }
    ) : null,
    isLoading ? /* @__PURE__ */ jsx14(Text3, { variant: "secondary", children: loadingLabel }) : sessions === null || sessions.length === 0 ? /* @__PURE__ */ jsx14(Text3, { variant: "secondary", children: emptyLabel }) : /* @__PURE__ */ jsx14("ul", { className: "space-y-3", children: sessions.map((session) => {
      const isCurrent = session.token === currentSessionToken;
      return /* @__PURE__ */ jsx14(
        SessionRow,
        {
          session,
          isCurrent,
          isRevoking: revokingToken === session.token,
          currentBadgeLabel,
          lastActivePrefix,
          formatTimestamp,
          revokeLabel,
          revokingLabel,
          onRevoke: () => void handleRevoke(session)
        },
        session.id
      );
    }) })
  ] }) });
}
function SessionRow({
  session,
  isCurrent,
  isRevoking,
  currentBadgeLabel,
  lastActivePrefix,
  formatTimestamp,
  revokeLabel,
  revokingLabel,
  onRevoke
}) {
  const updatedAt = session.updatedAt !== void 0 ? formatTimestamp(session.updatedAt) : "";
  return /* @__PURE__ */ jsxs12("li", { className: "flex items-start justify-between gap-4", children: [
    /* @__PURE__ */ jsxs12("div", { className: "min-w-0", children: [
      /* @__PURE__ */ jsxs12(Text3, { as: "span", truncate: true, children: [
        isCurrent ? currentBadgeLabel : session.userAgent ?? "Device",
        isCurrent || !session.ipAddress ? null : /* @__PURE__ */ jsx14(
          Text3,
          {
            as: "span",
            variant: "secondary",
            size: "sm",
            DANGEROUS_className: "ml-2",
            children: session.ipAddress
          }
        )
      ] }),
      updatedAt.length > 0 ? /* @__PURE__ */ jsxs12(Text3, { as: "span", variant: "secondary", size: "sm", children: [
        lastActivePrefix,
        ": ",
        updatedAt
      ] }) : null
    ] }),
    isCurrent ? null : /* @__PURE__ */ jsx14(
      Button4,
      {
        type: "button",
        variant: "ghost",
        onClick: onRevoke,
        loading: isRevoking,
        children: isRevoking ? revokingLabel : revokeLabel
      }
    )
  ] });
}

// src/forms/create-organization-form.tsx
import { useState as useState12 } from "react";
import { Input as Input9 } from "@cloudflare/kumo/components/input";
import { Button as Button5 } from "@cloudflare/kumo/components/button";
import { z as z7 } from "zod";
import { jsx as jsx15, jsxs as jsxs13 } from "react/jsx-runtime";
var slugRegex = /^[a-z0-9-]+$/;
var createOrganizationSchema = z7.object({
  name: z7.string().min(1, "Name is required."),
  slug: z7.string().min(1, "Slug is required.").regex(
    slugRegex,
    "Slug must contain only lowercase letters, numbers, and hyphens."
  ),
  logo: z7.string().optional()
});
function CreateOrganizationForm({
  className,
  errorClassName,
  title = "Create workspace",
  description = "Set up a new workspace for your team.",
  submitLabel = "Create workspace",
  submittingLabel = "Creating\u2026",
  cancelLabel = "Cancel",
  showCancel = true,
  onSuccess,
  onCancel
}) {
  const client = useAuth();
  const [name, setName] = useState12("");
  const [slug, setSlug] = useState12("");
  const [logo, setLogo] = useState12("");
  const [isSubmitting, setIsSubmitting] = useState12(false);
  const [error, setError] = useState12(null);
  const [fieldErrors, setFieldErrors] = useState12({});
  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    const validation = createOrganizationSchema.safeParse({
      name,
      slug,
      logo: logo || void 0
    });
    if (!validation.success) {
      const flattened = validation.error.flatten().fieldErrors;
      setFieldErrors({
        name: flattened.name?.[0],
        slug: flattened.slug?.[0],
        logo: flattened.logo?.[0]
      });
      return;
    }
    if (client.organization?.create === void 0) {
      setError("Organization creation is not available.");
      return;
    }
    setIsSubmitting(true);
    setFieldErrors({});
    try {
      const response = await client.organization.create(validation.data);
      if (response.error !== null) {
        setError(response.error.message ?? "Could not create workspace.");
        return;
      }
      if (response.data) {
        onSuccess?.(response.data);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create workspace."
      );
    } finally {
      setIsSubmitting(false);
    }
  }
  return /* @__PURE__ */ jsx15(AuthCard, { className, title, description, children: /* @__PURE__ */ jsxs13("form", { onSubmit: handleSubmit, className: "space-y-4", children: [
    /* @__PURE__ */ jsx15(AuthError, { message: error, className: errorClassName }),
    /* @__PURE__ */ jsx15(
      Input9,
      {
        label: "Workspace name",
        value: name,
        onValueChange: (value) => {
          setName(value);
          if (slug.length === 0) {
            setSlug(
              value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
            );
          }
        },
        error: fieldErrors.name,
        placeholder: "Acme Corp",
        required: true
      }
    ),
    /* @__PURE__ */ jsx15(
      Input9,
      {
        label: "Slug",
        value: slug,
        onValueChange: setSlug,
        error: fieldErrors.slug,
        placeholder: "acme-corp",
        description: "Used in URLs. Lowercase letters, numbers, and hyphens only.",
        required: true
      }
    ),
    /* @__PURE__ */ jsx15(
      Input9,
      {
        label: "Logo URL (optional)",
        value: logo,
        onValueChange: setLogo,
        error: fieldErrors.logo,
        placeholder: "https://\u2026"
      }
    ),
    /* @__PURE__ */ jsxs13("div", { className: "flex gap-2", children: [
      /* @__PURE__ */ jsx15(AuthSubmitButton, { loading: isSubmitting, className: "flex-1", children: isSubmitting ? submittingLabel : submitLabel }),
      showCancel ? /* @__PURE__ */ jsx15(
        Button5,
        {
          type: "button",
          variant: "secondary",
          onClick: () => onCancel?.(),
          className: "flex-1",
          children: cancelLabel
        }
      ) : null
    ] })
  ] }) });
}

// src/forms/organization-list.tsx
import { useEffect as useEffect4, useState as useState13 } from "react";
import { Button as Button6 } from "@cloudflare/kumo/components/button";
import { Text as Text4 } from "@cloudflare/kumo/components/text";
import { Fragment as Fragment6, jsx as jsx16, jsxs as jsxs14 } from "react/jsx-runtime";
function OrganizationList({
  className,
  errorClassName,
  title = "Workspaces",
  description = "Select a workspace or manage invitations.",
  membershipsLabel = "Your workspaces",
  invitationsLabel = "Invitations",
  currentLabel = "Current",
  selectLabel = "Open",
  acceptLabel = "Accept",
  rejectLabel = "Decline",
  createLabel = "Create workspace",
  noOrganizationsLabel = "You are not a member of any workspace.",
  noInvitationsLabel = "No pending invitations.",
  loadingLabel = "Loading\u2026",
  currentOrganizationId,
  showCreateButton = true,
  onSelectOrganization,
  onCreateOrganization,
  onAcceptInvitation,
  onRejectInvitation
}) {
  const client = useAuth();
  const [organizations, setOrganizations] = useState13(
    null
  );
  const [invitations, setInvitations] = useState13(null);
  const [isLoading, setIsLoading] = useState13(true);
  const [error, setError] = useState13(null);
  async function load() {
    setError(null);
    if (client.organization?.list === void 0 && client.organization?.listUserInvitations === void 0) {
      setError("Organization listing is not available.");
      setIsLoading(false);
      return;
    }
    try {
      const [orgsResponse, invitesResponse] = await Promise.all([
        client.organization?.list?.() ?? { data: [], error: null },
        client.organization?.listUserInvitations?.() ?? {
          data: [],
          error: null
        }
      ]);
      if (orgsResponse.error !== null) {
        setError(orgsResponse.error.message ?? "Could not load workspaces.");
      } else {
        setOrganizations(orgsResponse.data ?? []);
      }
      if (invitesResponse.error !== null) {
        setError(
          invitesResponse.error.message ?? "Could not load invitations."
        );
      } else {
        setInvitations(invitesResponse.data ?? []);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load workspaces."
      );
    } finally {
      setIsLoading(false);
    }
  }
  useEffect4(() => {
    void load();
  }, [client]);
  async function handleAccept(invitation) {
    if (client.organization?.acceptInvitation === void 0) {
      setError("Accept invitation is not available.");
      return;
    }
    setError(null);
    const response = await client.organization.acceptInvitation({
      invitationId: invitation.id
    });
    if (response.error !== null) {
      setError(response.error.message ?? "Could not accept invitation.");
      return;
    }
    onAcceptInvitation?.(invitation);
    await load();
  }
  async function handleReject(invitation) {
    if (client.organization?.rejectInvitation === void 0) {
      setError("Reject invitation is not available.");
      return;
    }
    setError(null);
    const response = await client.organization.rejectInvitation({
      invitationId: invitation.id
    });
    if (response.error !== null) {
      setError(response.error.message ?? "Could not reject invitation.");
      return;
    }
    onRejectInvitation?.(invitation);
    await load();
  }
  async function handleSelect(organization) {
    if (client.organization?.setActive === void 0) {
      setError("Set active workspace is not available.");
      return;
    }
    setError(null);
    const response = await client.organization.setActive({
      organizationId: organization.id
    });
    if (response.error !== null) {
      setError(response.error.message ?? "Could not switch workspace.");
      return;
    }
    onSelectOrganization?.(organization);
    await load();
  }
  return /* @__PURE__ */ jsx16(AuthCard, { className, title, description, children: /* @__PURE__ */ jsxs14("div", { className: "space-y-4", children: [
    /* @__PURE__ */ jsx16(AuthError, { message: error, className: errorClassName }),
    isLoading ? /* @__PURE__ */ jsx16(Text4, { variant: "secondary", children: loadingLabel }) : /* @__PURE__ */ jsxs14(Fragment6, { children: [
      /* @__PURE__ */ jsxs14("div", { children: [
        /* @__PURE__ */ jsx16(Text4, { as: "h3", variant: "heading", children: membershipsLabel }),
        organizations === null || organizations.length === 0 ? /* @__PURE__ */ jsx16(Text4, { variant: "secondary", children: noOrganizationsLabel }) : /* @__PURE__ */ jsx16("ul", { className: "space-y-2", children: organizations.map((organization) => {
          const isCurrent = organization.id === currentOrganizationId;
          return /* @__PURE__ */ jsxs14(
            "li",
            {
              className: "flex items-center justify-between gap-2",
              children: [
                /* @__PURE__ */ jsx16(Text4, { truncate: true, children: organization.name }),
                isCurrent ? /* @__PURE__ */ jsx16(Text4, { variant: "secondary", size: "sm", children: currentLabel }) : /* @__PURE__ */ jsx16(
                  Button6,
                  {
                    type: "button",
                    variant: "ghost",
                    onClick: () => void handleSelect(organization),
                    children: selectLabel
                  }
                )
              ]
            },
            organization.id
          );
        }) })
      ] }),
      invitations !== null && invitations.length > 0 ? /* @__PURE__ */ jsxs14("div", { children: [
        /* @__PURE__ */ jsx16(Text4, { as: "h3", variant: "heading", children: invitationsLabel }),
        /* @__PURE__ */ jsx16("ul", { className: "space-y-2", children: invitations.map((invitation) => /* @__PURE__ */ jsxs14(
          "li",
          {
            className: "flex items-center justify-between gap-2",
            children: [
              /* @__PURE__ */ jsx16(Text4, { truncate: true, children: invitation.email }),
              /* @__PURE__ */ jsxs14("div", { className: "flex gap-2", children: [
                /* @__PURE__ */ jsx16(
                  Button6,
                  {
                    type: "button",
                    variant: "ghost",
                    onClick: () => void handleAccept(invitation),
                    children: acceptLabel
                  }
                ),
                /* @__PURE__ */ jsx16(
                  Button6,
                  {
                    type: "button",
                    variant: "ghost",
                    onClick: () => void handleReject(invitation),
                    children: rejectLabel
                  }
                )
              ] })
            ]
          },
          invitation.id
        )) })
      ] }) : /* @__PURE__ */ jsx16(Text4, { variant: "secondary", size: "sm", children: noInvitationsLabel }),
      showCreateButton ? /* @__PURE__ */ jsx16(
        Button6,
        {
          type: "button",
          variant: "secondary",
          className: "w-full",
          onClick: () => onCreateOrganization?.(),
          children: createLabel
        }
      ) : null
    ] })
  ] }) });
}

// src/forms/organization-switcher.tsx
import { useEffect as useEffect5, useState as useState14 } from "react";
import { Button as Button7 } from "@cloudflare/kumo/components/button";
import { Select } from "@cloudflare/kumo/components/select";
import { Text as Text5 } from "@cloudflare/kumo/components/text";
import { jsx as jsx17, jsxs as jsxs15 } from "react/jsx-runtime";
function OrganizationSwitcher({
  className,
  errorClassName,
  currentOrganizationId,
  title = "Workspace",
  description = "Switch the active workspace.",
  placeholder = "Select a workspace\u2026",
  createLabel = "Create workspace",
  loadingLabel = "Loading workspaces\u2026",
  emptyLabel = "No workspaces found.",
  personalAccountLabel = "Personal account",
  showPersonalAccount = false,
  showCreateButton = true,
  onChange,
  onCreateOrganization
}) {
  const client = useAuth();
  const [organizations, setOrganizations] = useState14(
    null
  );
  const [isLoading, setIsLoading] = useState14(true);
  const [error, setError] = useState14(null);
  async function load() {
    setError(null);
    if (client.organization?.list === void 0) {
      setError("Workspace switching is not available.");
      setIsLoading(false);
      return;
    }
    try {
      const response = await client.organization.list();
      if (response.error !== null) {
        setError(response.error.message ?? "Could not load workspaces.");
        return;
      }
      setOrganizations(response.data ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load workspaces."
      );
    } finally {
      setIsLoading(false);
    }
  }
  useEffect5(() => {
    void load();
  }, [client]);
  async function handleValueChange(value) {
    if (value === null) return;
    if (client.organization?.setActive === void 0) {
      setError("Set active workspace is not available.");
      return;
    }
    if (value === "__personal__") {
      const response2 = await client.organization.setActive({
        organizationId: null
      });
      if (response2.error !== null) {
        setError(response2.error.message ?? "Could not switch workspace.");
        return;
      }
      onChange?.(null);
      return;
    }
    const organization = organizations?.find((o) => o.id === value);
    if (!organization) return;
    const response = await client.organization.setActive({
      organizationId: organization.id
    });
    if (response.error !== null) {
      setError(response.error.message ?? "Could not switch workspace.");
      return;
    }
    onChange?.(organization);
  }
  if (isLoading) {
    return /* @__PURE__ */ jsx17(AuthCard, { className, title, description, children: /* @__PURE__ */ jsx17(Text5, { variant: "secondary", children: loadingLabel }) });
  }
  const items = {};
  if (showPersonalAccount) {
    items.__personal__ = personalAccountLabel;
  }
  for (const organization of organizations ?? []) {
    items[organization.id] = organization.name;
  }
  return /* @__PURE__ */ jsx17(AuthCard, { className, title, description, children: /* @__PURE__ */ jsxs15("div", { className: "space-y-4", children: [
    /* @__PURE__ */ jsx17(AuthError, { message: error, className: errorClassName }),
    (organizations ?? []).length === 0 ? /* @__PURE__ */ jsx17(Text5, { variant: "secondary", children: emptyLabel }) : /* @__PURE__ */ jsx17(
      Select,
      {
        value: currentOrganizationId ?? "__personal__",
        onValueChange: handleValueChange,
        items,
        placeholder
      }
    ),
    showCreateButton ? /* @__PURE__ */ jsx17(
      Button7,
      {
        type: "button",
        variant: "secondary",
        className: "w-full",
        onClick: () => onCreateOrganization?.(),
        children: createLabel
      }
    ) : null
  ] }) });
}

// src/forms/organization-profile.tsx
import { useEffect as useEffect6, useState as useState15 } from "react";
import { Button as Button8 } from "@cloudflare/kumo/components/button";
import { Input as Input10 } from "@cloudflare/kumo/components/input";
import { Text as Text6 } from "@cloudflare/kumo/components/text";
import { jsx as jsx18, jsxs as jsxs16 } from "react/jsx-runtime";
function OrganizationProfile({
  className,
  errorClassName,
  title = "Workspace settings",
  description = "Manage this workspace.",
  nameLabel = "Workspace name",
  slugLabel = "Slug",
  logoLabel = "Logo URL",
  saveLabel = "Save",
  savingLabel = "Saving\u2026",
  deleteLabel = "Delete workspace",
  deletingLabel = "Deleting\u2026",
  deletedMessage = "Workspace deleted.",
  organizationId: targetOrganizationId,
  onUpdated,
  onDeleted
}) {
  const client = useAuth();
  const [organization, setOrganization] = useState15(
    null
  );
  const [isLoading, setIsLoading] = useState15(true);
  const [isSaving, setIsSaving] = useState15(false);
  const [isDeleting, setIsDeleting] = useState15(false);
  const [error, setError] = useState15(null);
  async function load() {
    if (client.organization?.getFullOrganization === void 0) {
      setError("Organization profile is not available.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await client.organization.getFullOrganization({
        query: targetOrganizationId ? { organizationId: targetOrganizationId } : void 0
      });
      if (response.error !== null) {
        setError(response.error.message ?? "Could not load workspace.");
        return;
      }
      setOrganization(response.data ?? null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load workspace."
      );
    } finally {
      setIsLoading(false);
    }
  }
  useEffect6(() => {
    void load();
  }, [client]);
  async function handleSubmit(event) {
    event.preventDefault();
    if (organization === null) return;
    if (client.organization?.update === void 0) {
      setError("Organization update is not available.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const response = await client.organization.update({
        data: {
          name: organization.name,
          slug: organization.slug,
          logo: organization.logo,
          metadata: organization.metadata
        },
        organizationId: targetOrganizationId
      });
      if (response.error !== null) {
        setError(response.error.message ?? "Could not update workspace.");
      } else if (response.data) {
        onUpdated?.({ ...organization, ...response.data });
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update workspace."
      );
    } finally {
      setIsSaving(false);
    }
  }
  async function handleDelete() {
    if (organization === null) return;
    if (client.organization?.["delete"] === void 0) {
      setError("Organization deletion is not available.");
      return;
    }
    setIsDeleting(true);
    setError(null);
    try {
      const response = await client.organization["delete"]({
        organizationId: targetOrganizationId ?? organization.id
      });
      if (response.error !== null) {
        setError(response.error.message ?? "Could not delete workspace.");
      } else {
        onDeleted?.();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not delete workspace."
      );
    } finally {
      setIsDeleting(false);
    }
  }
  if (isLoading) {
    return /* @__PURE__ */ jsx18(AuthCard, { className, title, description, children: /* @__PURE__ */ jsx18(Text6, { variant: "secondary", children: "Loading\u2026" }) });
  }
  if (organization === null) {
    return /* @__PURE__ */ jsxs16(AuthCard, { className, title, description, children: [
      /* @__PURE__ */ jsx18(AuthError, { message: error, className: errorClassName }),
      /* @__PURE__ */ jsx18(Text6, { variant: "secondary", children: "No active workspace found." })
    ] });
  }
  return /* @__PURE__ */ jsx18(AuthCard, { className, title, description, children: /* @__PURE__ */ jsxs16("form", { onSubmit: handleSubmit, className: "space-y-4", children: [
    /* @__PURE__ */ jsx18(AuthError, { message: error, className: errorClassName }),
    /* @__PURE__ */ jsx18(
      Input10,
      {
        label: nameLabel,
        value: organization.name,
        onValueChange: (value) => setOrganization((org) => org ? { ...org, name: value } : org),
        required: true
      }
    ),
    /* @__PURE__ */ jsx18(
      Input10,
      {
        label: slugLabel,
        value: organization.slug,
        onValueChange: (value) => setOrganization((org) => org ? { ...org, slug: value } : org),
        required: true
      }
    ),
    /* @__PURE__ */ jsx18(
      Input10,
      {
        label: logoLabel,
        value: organization.logo ?? "",
        onValueChange: (value) => setOrganization(
          (org) => org ? { ...org, logo: value.length > 0 ? value : null } : org
        )
      }
    ),
    /* @__PURE__ */ jsx18(
      Button8,
      {
        type: "submit",
        variant: "primary",
        className: "w-full",
        loading: isSaving,
        children: isSaving ? savingLabel : saveLabel
      }
    ),
    /* @__PURE__ */ jsx18("hr", { className: "border-kumo-hairline" }),
    /* @__PURE__ */ jsx18(
      Button8,
      {
        type: "button",
        variant: "destructive",
        className: "w-full",
        loading: isDeleting,
        onClick: handleDelete,
        children: isDeleting ? deletingLabel : deleteLabel
      }
    )
  ] }) });
}

// src/forms/organization-members.tsx
import { useEffect as useEffect7, useState as useState16 } from "react";
import { Button as Button9 } from "@cloudflare/kumo/components/button";
import { Input as Input11 } from "@cloudflare/kumo/components/input";
import { Select as Select2 } from "@cloudflare/kumo/components/select";
import { Text as Text7 } from "@cloudflare/kumo/components/text";
import { jsx as jsx19, jsxs as jsxs17 } from "react/jsx-runtime";
var defaultRoleOptions = ["owner", "admin", "member"];
function InviteMemberForm({
  className,
  errorClassName,
  title = "Invite member",
  description = "Add a teammate to this workspace.",
  emailLabel = "Email",
  roleLabel = "Role",
  submitLabel = "Send invite",
  submittingLabel = "Sending\u2026",
  roleOptions = defaultRoleOptions,
  defaultRole = "member",
  onInvite
}) {
  const client = useAuth();
  const [email, setEmail] = useState16("");
  const [role, setRole] = useState16(defaultRole);
  const [isSubmitting, setIsSubmitting] = useState16(false);
  const [error, setError] = useState16(null);
  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    if (client.organization?.inviteMember === void 0) {
      setError("Inviting members is not available.");
      return;
    }
    if (email.length === 0 || !email.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await client.organization.inviteMember({ email, role });
      if (response.error !== null) {
        setError(response.error.message ?? "Could not send invitation.");
      } else {
        onInvite?.(response.data);
        setEmail("");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not send invitation."
      );
    } finally {
      setIsSubmitting(false);
    }
  }
  return /* @__PURE__ */ jsx19(AuthCard, { className, title, description, children: /* @__PURE__ */ jsxs17("form", { onSubmit: handleSubmit, className: "space-y-4", children: [
    /* @__PURE__ */ jsx19(AuthError, { message: error, className: errorClassName }),
    /* @__PURE__ */ jsx19(
      Input11,
      {
        label: emailLabel,
        type: "email",
        value: email,
        onValueChange: setEmail,
        placeholder: "teammate@example.com",
        required: true
      }
    ),
    /* @__PURE__ */ jsx19(
      Select2,
      {
        label: roleLabel,
        value: role,
        onValueChange: (value) => setRole(value ?? defaultRole),
        items: Object.fromEntries(roleOptions.map((r) => [r, r]))
      }
    ),
    /* @__PURE__ */ jsx19(
      Button9,
      {
        type: "submit",
        variant: "primary",
        className: "w-full",
        loading: isSubmitting,
        children: isSubmitting ? submittingLabel : submitLabel
      }
    )
  ] }) });
}
function OrganizationMembers({
  className,
  errorClassName,
  title = "Members",
  description = "Manage workspace members.",
  loadingLabel = "Loading members\u2026",
  emptyLabel = "No members found.",
  membersLabel = "Members",
  invitationsLabel = "Pending invitations",
  removeLabel = "Remove",
  cancelLabel = "Cancel",
  updateRoleLabel = "Update role",
  roleOptions = defaultRoleOptions,
  canManageMembers = true,
  onMemberRemoved,
  onInvitationCancelled
}) {
  const client = useAuth();
  const session = client.useSession?.();
  const currentUserId = session?.data?.user?.id;
  const [fullOrg, setFullOrg] = useState16(null);
  const [isLoading, setIsLoading] = useState16(true);
  const [error, setError] = useState16(null);
  async function load() {
    if (client.organization?.getFullOrganization === void 0) {
      setError("Member management is not available.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await client.organization.getFullOrganization();
      if (response.error !== null) {
        setError(response.error.message ?? "Could not load members.");
        return;
      }
      setFullOrg(response.data ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load members.");
    } finally {
      setIsLoading(false);
    }
  }
  useEffect7(() => {
    void load();
  }, [client]);
  async function handleUpdateRole(member) {
    if (client.organization?.updateMemberRole === void 0) {
      setError("Updating roles is not available.");
      return;
    }
    setError(null);
    try {
      const response = await client.organization.updateMemberRole({
        memberId: member.id,
        role: member.role
      });
      if (response.error !== null) {
        setError(response.error.message ?? "Could not update role.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update role.");
    }
  }
  async function handleRemove(member) {
    if (client.organization?.removeMember === void 0) {
      setError("Removing members is not available.");
      return;
    }
    setError(null);
    try {
      const response = await client.organization.removeMember({
        memberIdOrEmail: member.user?.email ?? member.id
      });
      if (response.error !== null) {
        setError(response.error.message ?? "Could not remove member.");
      } else {
        onMemberRemoved?.();
        await load();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove member.");
    }
  }
  async function handleCancelInvitation(invitation) {
    if (client.organization?.cancelInvitation === void 0) {
      setError("Cancelling invitations is not available.");
      return;
    }
    setError(null);
    try {
      const response = await client.organization.cancelInvitation({
        invitationId: invitation.id
      });
      if (response.error !== null) {
        setError(response.error.message ?? "Could not cancel invitation.");
      } else {
        onInvitationCancelled?.();
        await load();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not cancel invitation."
      );
    }
  }
  if (isLoading) {
    return /* @__PURE__ */ jsx19(AuthCard, { className, title, description, children: /* @__PURE__ */ jsx19(Text7, { variant: "secondary", children: loadingLabel }) });
  }
  const members = fullOrg?.members ?? [];
  const invitations = fullOrg?.invitations ?? [];
  return /* @__PURE__ */ jsx19(AuthCard, { className, title, description, children: /* @__PURE__ */ jsxs17("div", { className: "space-y-4", children: [
    /* @__PURE__ */ jsx19(AuthError, { message: error, className: errorClassName }),
    /* @__PURE__ */ jsxs17("div", { children: [
      /* @__PURE__ */ jsx19(Text7, { as: "h3", variant: "heading", children: membersLabel }),
      members.length === 0 ? /* @__PURE__ */ jsx19(Text7, { variant: "secondary", children: emptyLabel }) : /* @__PURE__ */ jsx19("ul", { className: "space-y-2", children: members.map((member) => {
        const isCurrentUser = member.user?.id === currentUserId;
        return /* @__PURE__ */ jsxs17(
          "li",
          {
            className: "flex items-center justify-between gap-2",
            children: [
              /* @__PURE__ */ jsxs17("div", { className: "min-w-0", children: [
                /* @__PURE__ */ jsxs17(Text7, { truncate: true, children: [
                  member.user?.name ?? "Unknown",
                  isCurrentUser ? " (you)" : ""
                ] }),
                /* @__PURE__ */ jsx19(Text7, { variant: "secondary", size: "sm", truncate: true, children: member.user?.email ?? member.userId })
              ] }),
              canManageMembers ? /* @__PURE__ */ jsxs17("div", { className: "flex items-center gap-2", children: [
                /* @__PURE__ */ jsx19(
                  Select2,
                  {
                    value: member.role,
                    onValueChange: (value) => {
                      const nextRole = value ?? member.role;
                      setFullOrg(
                        (org) => org ? {
                          ...org,
                          members: org.members.map(
                            (m) => m.id === member.id ? { ...m, role: nextRole } : m
                          )
                        } : org
                      );
                      void handleUpdateRole({
                        ...member,
                        role: nextRole
                      });
                    },
                    items: Object.fromEntries(
                      roleOptions.map((r) => [r, r])
                    ),
                    "aria-label": updateRoleLabel
                  }
                ),
                !isCurrentUser ? /* @__PURE__ */ jsx19(
                  Button9,
                  {
                    type: "button",
                    variant: "ghost",
                    onClick: () => void handleRemove(member),
                    children: removeLabel
                  }
                ) : null
              ] }) : /* @__PURE__ */ jsx19(Text7, { variant: "secondary", size: "sm", children: member.role })
            ]
          },
          member.id
        );
      }) })
    ] }),
    invitations.length > 0 ? /* @__PURE__ */ jsxs17("div", { children: [
      /* @__PURE__ */ jsx19(Text7, { as: "h3", variant: "heading", children: invitationsLabel }),
      /* @__PURE__ */ jsx19("ul", { className: "space-y-2", children: invitations.map((invitation) => /* @__PURE__ */ jsxs17(
        "li",
        {
          className: "flex items-center justify-between gap-2",
          children: [
            /* @__PURE__ */ jsxs17("div", { className: "min-w-0", children: [
              /* @__PURE__ */ jsx19(Text7, { truncate: true, children: invitation.email }),
              /* @__PURE__ */ jsx19(Text7, { variant: "secondary", size: "sm", truncate: true, children: invitation.role })
            ] }),
            canManageMembers ? /* @__PURE__ */ jsx19(
              Button9,
              {
                type: "button",
                variant: "ghost",
                onClick: () => void handleCancelInvitation(invitation),
                children: cancelLabel
              }
            ) : null
          ]
        },
        invitation.id
      )) })
    ] }) : null
  ] }) });
}

// src/forms/accept-invite-screen.tsx
import { useEffect as useEffect8, useState as useState17 } from "react";
import { Button as Button10 } from "@cloudflare/kumo/components/button";
import { Text as Text8 } from "@cloudflare/kumo/components/text";
import { jsx as jsx20, jsxs as jsxs18 } from "react/jsx-runtime";
function AcceptInviteScreen({
  token,
  className,
  errorClassName,
  title = "Accept invitation",
  description = "Join the workspace you were invited to.",
  successMessage = "You're now a member of the workspace.",
  unavailableMessage = "Invitation acceptance is not available.",
  onSuccess,
  onSignIn,
  signInLabel = "Sign in to accept"
}) {
  const client = useAuth();
  const session = client.useSession?.();
  const [status, setStatus] = useState17("idle");
  const [error, setError] = useState17(null);
  useEffect8(() => {
    if (session?.isPending) return;
    if (!session?.data?.user) {
      return;
    }
    if (client.organization?.acceptInvitation === void 0) {
      setError(unavailableMessage);
      setStatus("error");
      return;
    }
    let cancelled = false;
    async function accept() {
      setStatus("accepting");
      setError(null);
      try {
        const response = await client.organization.acceptInvitation({
          invitationId: token
        });
        if (cancelled) return;
        if (response.error !== null) {
          setError(response.error.message ?? "Could not accept invitation.");
          setStatus("error");
          return;
        }
        setStatus("accepted");
        onSuccess?.();
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Could not accept invitation."
        );
        setStatus("error");
      }
    }
    void accept();
    return () => {
      cancelled = true;
    };
  }, [token, client, session, onSuccess, unavailableMessage]);
  if (session?.isPending ?? true) {
    return /* @__PURE__ */ jsx20(AuthCard, { className, title, description, children: /* @__PURE__ */ jsx20(Text8, { variant: "secondary", children: "Loading\u2026" }) });
  }
  if (!session?.data?.user) {
    return /* @__PURE__ */ jsxs18(AuthCard, { className, title, description, children: [
      /* @__PURE__ */ jsx20(
        AuthError,
        {
          message: "Sign in or create an account to accept this invitation.",
          className: errorClassName
        }
      ),
      onSignIn ? /* @__PURE__ */ jsx20(
        Button10,
        {
          type: "button",
          variant: "primary",
          className: "w-full",
          onClick: onSignIn,
          children: signInLabel
        }
      ) : null
    ] });
  }
  return /* @__PURE__ */ jsx20(AuthCard, { className, title, description, children: /* @__PURE__ */ jsxs18("div", { className: "space-y-4", children: [
    /* @__PURE__ */ jsx20(AuthError, { message: error, className: errorClassName }),
    status === "accepted" ? /* @__PURE__ */ jsx20(Text8, { variant: "secondary", children: successMessage }) : /* @__PURE__ */ jsx20(Text8, { variant: "secondary", children: status === "accepting" ? "Accepting your invitation\u2026" : "Ready to accept." })
  ] }) });
}

// src/forms/user-profile-form.tsx
import { useEffect as useEffect9, useState as useState18 } from "react";
import { Input as Input12 } from "@cloudflare/kumo/components/input";
import { jsx as jsx21, jsxs as jsxs19 } from "react/jsx-runtime";
function UserProfileForm({
  className,
  errorClassName,
  title = "Account",
  description = "Manage your profile.",
  nameLabel = "Name",
  imageUrlLabel = "Profile picture URL",
  imageUrlPlaceholder = "https://\u2026",
  submitLabel = "Save",
  submittingLabel = "Saving\u2026",
  unavailableMessage = "Profile update is not available.",
  onSuccess
}) {
  const client = useAuth();
  const session = client.useSession?.();
  const [name, setName] = useState18("");
  const [image, setImage] = useState18("");
  const [isSubmitting, setIsSubmitting] = useState18(false);
  const [error, setError] = useState18(null);
  useEffect9(() => {
    if (session?.data?.user) {
      setName(session.data.user.name ?? "");
      setImage(session.data.user.image ?? "");
    }
  }, [session?.data?.user]);
  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    if (client.updateUser === void 0) {
      setError(unavailableMessage);
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await client.updateUser({
        name,
        image: image.length > 0 ? image : null
      });
      if (response.error !== null) {
        setError(response.error.message ?? "Could not update profile.");
      } else {
        onSuccess?.();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update profile."
      );
    } finally {
      setIsSubmitting(false);
    }
  }
  return /* @__PURE__ */ jsx21(AuthCard, { className, title, description, children: /* @__PURE__ */ jsxs19("form", { onSubmit: handleSubmit, className: "space-y-4", children: [
    /* @__PURE__ */ jsx21(AuthError, { message: error, className: errorClassName }),
    /* @__PURE__ */ jsx21(
      Input12,
      {
        label: nameLabel,
        value: name,
        onValueChange: setName,
        placeholder: "Ada Lovelace",
        required: true
      }
    ),
    /* @__PURE__ */ jsx21(
      Input12,
      {
        label: imageUrlLabel,
        value: image,
        onValueChange: setImage,
        placeholder: imageUrlPlaceholder
      }
    ),
    /* @__PURE__ */ jsx21(AuthSubmitButton, { loading: isSubmitting, className: "w-full", children: isSubmitting ? submittingLabel : submitLabel })
  ] }) });
}

// src/forms/change-email-form.tsx
import { useState as useState19 } from "react";
import { Input as Input13 } from "@cloudflare/kumo/components/input";
import { Text as Text9 } from "@cloudflare/kumo/components/text";
import { z as z8 } from "zod";
import { Fragment as Fragment7, jsx as jsx22, jsxs as jsxs20 } from "react/jsx-runtime";
var emailSchema = z8.object({
  email: z8.string().email("Please enter a valid email address.")
});
function ChangeEmailForm({
  className,
  errorClassName,
  title = "Change email",
  description = "Update the email address for this account.",
  emailLabel = "New email",
  submitLabel = "Send verification",
  submittingLabel = "Sending\u2026",
  successMessage = "Check your new email address for a verification link.",
  unavailableMessage = "Email change is not available.",
  callbackURL,
  onSuccess
}) {
  const client = useAuth();
  const [email, setEmail] = useState19("");
  const [isSubmitting, setIsSubmitting] = useState19(false);
  const [error, setError] = useState19(null);
  const [success, setSuccess] = useState19(false);
  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    const validation = emailSchema.safeParse({ email });
    if (!validation.success) {
      setError(validation.error.flatten().fieldErrors.email?.[0] ?? "");
      return;
    }
    if (client.changeEmail === void 0) {
      setError(unavailableMessage);
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await client.changeEmail({
        newEmail: validation.data.email,
        callbackURL
      });
      if (response.error !== null) {
        setError(response.error.message ?? "Could not change email.");
      } else {
        setSuccess(true);
        onSuccess?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change email.");
    } finally {
      setIsSubmitting(false);
    }
  }
  return /* @__PURE__ */ jsx22(AuthCard, { className, title, description, children: /* @__PURE__ */ jsxs20("form", { onSubmit: handleSubmit, className: "space-y-4", children: [
    /* @__PURE__ */ jsx22(AuthError, { message: error, className: errorClassName }),
    success ? /* @__PURE__ */ jsx22(Text9, { variant: "secondary", children: successMessage }) : /* @__PURE__ */ jsxs20(Fragment7, { children: [
      /* @__PURE__ */ jsx22(
        Input13,
        {
          label: emailLabel,
          type: "email",
          value: email,
          onValueChange: setEmail,
          placeholder: "ada@example.com",
          required: true
        }
      ),
      /* @__PURE__ */ jsx22(AuthSubmitButton, { loading: isSubmitting, className: "w-full", children: isSubmitting ? submittingLabel : submitLabel })
    ] })
  ] }) });
}

// src/forms/verify-backup-code-form.tsx
import { useState as useState20 } from "react";
import { Input as Input14 } from "@cloudflare/kumo/components/input";
import { jsx as jsx23, jsxs as jsxs21 } from "react/jsx-runtime";
function VerifyBackupCodeForm({
  className,
  errorClassName,
  title = "Use a backup code",
  description = "Enter one of the recovery codes you saved when you enabled two-factor authentication.",
  codeLabel = "Backup code",
  submitLabel = "Verify",
  submittingLabel = "Verifying\u2026",
  trustDeviceLabel = "Trust this device",
  unavailableMessage = "Backup code verification is not available.",
  onSuccess
}) {
  const client = useAuth();
  const [code, setCode] = useState20("");
  const [trustDevice, setTrustDevice] = useState20(false);
  const [isSubmitting, setIsSubmitting] = useState20(false);
  const [error, setError] = useState20(null);
  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    if (client.twoFactor?.verifyBackupCode === void 0) {
      setError(unavailableMessage);
      return;
    }
    if (code.length === 0) {
      setError("Enter a backup code.");
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await client.twoFactor.verifyBackupCode({
        code,
        trustDevice
      });
      if (response.error !== null) {
        setError(response.error.message ?? "Could not verify backup code.");
      } else {
        onSuccess?.();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not verify backup code."
      );
    } finally {
      setIsSubmitting(false);
    }
  }
  return /* @__PURE__ */ jsx23(AuthCard, { className, title, description, children: /* @__PURE__ */ jsxs21("form", { onSubmit: handleSubmit, className: "space-y-4", children: [
    /* @__PURE__ */ jsx23(AuthError, { message: error, className: errorClassName }),
    /* @__PURE__ */ jsx23(
      Input14,
      {
        label: codeLabel,
        value: code,
        onValueChange: setCode,
        autoComplete: "off",
        required: true
      }
    ),
    /* @__PURE__ */ jsxs21("label", { className: "flex items-center gap-2 text-sm", children: [
      /* @__PURE__ */ jsx23(
        "input",
        {
          type: "checkbox",
          checked: trustDevice,
          onChange: (event) => setTrustDevice(event.target.checked)
        }
      ),
      trustDeviceLabel
    ] }),
    /* @__PURE__ */ jsx23(AuthSubmitButton, { loading: isSubmitting, className: "w-full", children: isSubmitting ? submittingLabel : submitLabel })
  ] }) });
}

// src/forms/disable-two-factor-form.tsx
import { useState as useState21 } from "react";
import { Input as Input15 } from "@cloudflare/kumo/components/input";
import { jsx as jsx24, jsxs as jsxs22 } from "react/jsx-runtime";
function DisableTwoFactorForm({
  className,
  errorClassName,
  title = "Disable two-factor authentication",
  description = "Confirm your password to turn off 2FA.",
  passwordLabel = "Password",
  submitLabel = "Disable 2FA",
  submittingLabel = "Disabling\u2026",
  unavailableMessage = "Two-factor authentication is not available.",
  onSuccess
}) {
  const client = useAuth();
  const [password, setPassword] = useState21("");
  const [isSubmitting, setIsSubmitting] = useState21(false);
  const [error, setError] = useState21(null);
  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    if (client.twoFactor?.disable === void 0) {
      setError(unavailableMessage);
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await client.twoFactor.disable({ password });
      if (response.error !== null) {
        setError(response.error.message ?? "Could not disable 2FA.");
      } else {
        onSuccess?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not disable 2FA.");
    } finally {
      setIsSubmitting(false);
    }
  }
  return /* @__PURE__ */ jsx24(AuthCard, { className, title, description, children: /* @__PURE__ */ jsxs22("form", { onSubmit: handleSubmit, className: "space-y-4", children: [
    /* @__PURE__ */ jsx24(AuthError, { message: error, className: errorClassName }),
    /* @__PURE__ */ jsx24(
      Input15,
      {
        label: passwordLabel,
        type: "password",
        value: password,
        onValueChange: setPassword,
        autoComplete: "current-password"
      }
    ),
    /* @__PURE__ */ jsx24(
      AuthSubmitButton,
      {
        loading: isSubmitting,
        className: "w-full",
        variant: "destructive",
        children: isSubmitting ? submittingLabel : submitLabel
      }
    )
  ] }) });
}

// src/forms/generate-backup-codes-form.tsx
import { useState as useState22 } from "react";
import { Button as Button11 } from "@cloudflare/kumo/components/button";
import { Input as Input16 } from "@cloudflare/kumo/components/input";
import { Text as Text10 } from "@cloudflare/kumo/components/text";
import { jsx as jsx25, jsxs as jsxs23 } from "react/jsx-runtime";
function GenerateBackupCodesForm({
  className,
  errorClassName,
  title = "Regenerate backup codes",
  description = "Generate a fresh set of recovery codes. Any old codes will stop working.",
  passwordLabel = "Password (if required)",
  submitLabel = "Generate codes",
  submittingLabel = "Generating\u2026",
  doneLabel = "Done",
  savedWarning = "Save these somewhere safe. They won't be shown again.",
  unavailableMessage = "Backup code generation is not available.",
  onSuccess
}) {
  const client = useAuth();
  const [password, setPassword] = useState22("");
  const [codes, setCodes] = useState22(null);
  const [isSubmitting, setIsSubmitting] = useState22(false);
  const [error, setError] = useState22(null);
  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setCodes(null);
    if (client.twoFactor?.generateBackupCodes === void 0) {
      setError(unavailableMessage);
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await client.twoFactor.generateBackupCodes({
        password
      });
      if (response.error !== null) {
        setError(response.error.message ?? "Could not generate backup codes.");
      } else {
        const backupCodes = response.data?.backupCodes ?? [];
        setCodes(backupCodes);
        onSuccess?.(backupCodes);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not generate backup codes."
      );
    } finally {
      setIsSubmitting(false);
    }
  }
  return /* @__PURE__ */ jsx25(AuthCard, { className, title, description, children: codes !== null ? /* @__PURE__ */ jsxs23("div", { className: "space-y-4", children: [
    /* @__PURE__ */ jsx25(Text10, { variant: "secondary", size: "sm", children: savedWarning }),
    /* @__PURE__ */ jsx25("ul", { className: "grid grid-cols-2 gap-2", children: codes.map((code) => /* @__PURE__ */ jsx25("li", { children: /* @__PURE__ */ jsx25(Text10, { as: "code", variant: "mono", DANGEROUS_className: "break-all", children: code }) }, code)) }),
    /* @__PURE__ */ jsx25(
      Button11,
      {
        type: "button",
        variant: "secondary",
        className: "w-full",
        onClick: () => setCodes(null),
        children: doneLabel
      }
    )
  ] }) : /* @__PURE__ */ jsxs23("form", { onSubmit: handleSubmit, className: "space-y-4", children: [
    /* @__PURE__ */ jsx25(AuthError, { message: error, className: errorClassName }),
    /* @__PURE__ */ jsx25(
      Input16,
      {
        label: passwordLabel,
        type: "password",
        value: password,
        onValueChange: setPassword,
        autoComplete: "current-password"
      }
    ),
    /* @__PURE__ */ jsx25(
      Button11,
      {
        type: "submit",
        variant: "primary",
        className: "w-full",
        loading: isSubmitting,
        children: isSubmitting ? submittingLabel : submitLabel
      }
    )
  ] }) });
}

// src/forms/change-password-form.tsx
import { useState as useState23 } from "react";
import { Checkbox } from "@cloudflare/kumo/components/checkbox";
import { Input as Input17 } from "@cloudflare/kumo/components/input";
import { jsx as jsx26, jsxs as jsxs24 } from "react/jsx-runtime";
function ChangePasswordForm({
  className,
  errorClassName,
  title = "Change password",
  description = "Update the password for this account.",
  currentPasswordLabel = "Current password",
  newPasswordLabel = "New password",
  confirmPasswordLabel = "Confirm new password",
  revokeOtherSessionsLabel = "Sign out other sessions",
  submitLabel = "Update password",
  submittingLabel = "Updating\u2026",
  unavailableMessage = "Password change is not available.",
  onSuccess
}) {
  const client = useAuth();
  const [currentPassword, setCurrentPassword] = useState23("");
  const [newPassword, setNewPassword] = useState23("");
  const [confirmPassword, setConfirmPassword] = useState23("");
  const [revokeOtherSessions, setRevokeOtherSessions] = useState23(true);
  const [isSubmitting, setIsSubmitting] = useState23(false);
  const [error, setError] = useState23(null);
  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (client.changePassword === void 0) {
      setError(unavailableMessage);
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await client.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions
      });
      if (response.error !== null) {
        setError(response.error.message ?? "Could not change password.");
      } else {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        onSuccess?.();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not change password."
      );
    } finally {
      setIsSubmitting(false);
    }
  }
  return /* @__PURE__ */ jsx26(AuthCard, { className, title, description, children: /* @__PURE__ */ jsxs24("form", { onSubmit: handleSubmit, className: "space-y-4", children: [
    /* @__PURE__ */ jsx26(AuthError, { message: error, className: errorClassName }),
    /* @__PURE__ */ jsx26(
      Input17,
      {
        label: currentPasswordLabel,
        type: "password",
        value: currentPassword,
        onValueChange: setCurrentPassword,
        autoComplete: "current-password",
        required: true
      }
    ),
    /* @__PURE__ */ jsx26(
      Input17,
      {
        label: newPasswordLabel,
        type: "password",
        value: newPassword,
        onValueChange: setNewPassword,
        autoComplete: "new-password",
        required: true
      }
    ),
    /* @__PURE__ */ jsx26(
      Input17,
      {
        label: confirmPasswordLabel,
        type: "password",
        value: confirmPassword,
        onValueChange: setConfirmPassword,
        autoComplete: "new-password",
        required: true
      }
    ),
    /* @__PURE__ */ jsx26(
      Checkbox,
      {
        label: revokeOtherSessionsLabel,
        checked: revokeOtherSessions,
        onCheckedChange: (checked) => setRevokeOtherSessions(checked === true)
      }
    ),
    /* @__PURE__ */ jsx26(AuthSubmitButton, { loading: isSubmitting, className: "w-full", children: isSubmitting ? submittingLabel : submitLabel })
  ] }) });
}

// src/forms/connected-accounts.tsx
import { useEffect as useEffect10, useState as useState24 } from "react";
import { Button as Button12 } from "@cloudflare/kumo/components/button";
import { Text as Text11 } from "@cloudflare/kumo/components/text";
import { jsx as jsx27, jsxs as jsxs25 } from "react/jsx-runtime";
function ConnectedAccounts({
  className,
  errorClassName,
  title = "Connected accounts",
  description = "Manage the accounts linked to your profile.",
  emptyMessage = "No connected accounts.",
  linkableProviders,
  linkLabel = "Link account",
  unlinkLabel = "Unlink",
  unlinkingLabel = "Unlinking\u2026",
  unavailableMessage = "Connected accounts are not available.",
  callbackURL,
  errorCallbackURL,
  onLinked,
  onUnlinked
}) {
  const client = useAuth();
  const [accounts, setAccounts] = useState24([]);
  const [isLoading, setIsLoading] = useState24(true);
  const [isLinking, setIsLinking] = useState24(false);
  const [unlinkingId, setUnlinkingId] = useState24(null);
  const [error, setError] = useState24(null);
  async function loadAccounts() {
    if (client.listAccounts === void 0) {
      setError(unavailableMessage);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await client.listAccounts();
      setAccounts(response.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load accounts.");
    } finally {
      setIsLoading(false);
    }
  }
  useEffect10(() => {
    void loadAccounts();
  }, []);
  async function handleLink(providerId) {
    if (client.linkSocial === void 0) {
      setError("Account linking is not available.");
      return;
    }
    setIsLinking(true);
    setError(null);
    try {
      const response = await client.linkSocial({
        provider: providerId,
        callbackURL,
        errorCallbackURL
      });
      if (response.error !== null) {
        setError(response.error.message ?? "Could not link account.");
      } else {
        onLinked?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not link account.");
    } finally {
      setIsLinking(false);
    }
  }
  async function handleUnlink(account) {
    if (client.unlinkAccount === void 0) {
      setError("Account unlinking is not available.");
      return;
    }
    setUnlinkingId(account.id);
    setError(null);
    try {
      const response = await client.unlinkAccount({
        providerId: account.providerId,
        accountId: account.accountId
      });
      if (response.error !== null) {
        setError(response.error.message ?? "Could not unlink account.");
      } else {
        setAccounts((prev) => prev.filter((a) => a.id !== account.id));
        onUnlinked?.();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not unlink account."
      );
    } finally {
      setUnlinkingId(null);
    }
  }
  return /* @__PURE__ */ jsx27(AuthCard, { className, title, description, children: /* @__PURE__ */ jsxs25("div", { className: "space-y-4", children: [
    /* @__PURE__ */ jsx27(AuthError, { message: error, className: errorClassName }),
    isLoading ? /* @__PURE__ */ jsx27(Text11, { variant: "secondary", children: "Loading\u2026" }) : accounts.length === 0 ? /* @__PURE__ */ jsx27(Text11, { variant: "secondary", children: emptyMessage }) : /* @__PURE__ */ jsx27("ul", { className: "space-y-2", children: accounts.map((account) => /* @__PURE__ */ jsxs25(
      "li",
      {
        className: "flex items-center justify-between gap-2",
        children: [
          /* @__PURE__ */ jsx27(Text11, { variant: "secondary", children: account.providerId }),
          /* @__PURE__ */ jsx27(
            Button12,
            {
              type: "button",
              variant: "secondary",
              size: "sm",
              loading: unlinkingId === account.id,
              onClick: () => handleUnlink(account),
              children: unlinkingId === account.id ? unlinkingLabel : unlinkLabel
            }
          )
        ]
      },
      account.id
    )) }),
    linkableProviders !== void 0 && linkableProviders.length > 0 ? /* @__PURE__ */ jsx27(
      AuthProviderButtons,
      {
        providers: linkableProviders.map((provider) => ({
          ...provider,
          label: provider.label ?? `${linkLabel} ${provider.provider}`
        })),
        onSelect: handleLink,
        isSubmitting: isLinking,
        className: "space-y-2",
        providerButtonClassName: "w-full"
      }
    ) : null
  ] }) });
}

// src/forms/delete-account-form.tsx
import { useState as useState25 } from "react";
import { Input as Input18 } from "@cloudflare/kumo/components/input";
import { z as z9 } from "zod";
import { jsx as jsx28, jsxs as jsxs26 } from "react/jsx-runtime";
var deleteAccountSchema = z9.object({
  password: z9.string().min(1, "Enter your password")
});
function DeleteAccountForm({
  title = "Delete account",
  description = "This action cannot be undone. To confirm, type delete my account below and enter your password.",
  className,
  errorClassName,
  passwordLabel = "Password",
  confirmationLabel = "Confirm deletion",
  confirmationPlaceholder = "delete my account",
  submitLabel = "Delete account",
  submittingLabel = "Deleting\u2026",
  successMessage = "Your account has been deleted.",
  unavailableMessage = "Account deletion is not available.",
  mismatchMessage = "Type the exact phrase to confirm.",
  onSuccess
}) {
  const client = useAuth();
  const [password, setPassword] = useState25("");
  const [confirmation, setConfirmation] = useState25("");
  const [isSubmitting, setIsSubmitting] = useState25(false);
  const [error, setError] = useState25(null);
  const [success, setSuccess] = useState25(false);
  const [fieldErrors, setFieldErrors] = useState25({});
  if (client.deleteUser === void 0) {
    return /* @__PURE__ */ jsx28(AuthCard, { className, title, description, children: /* @__PURE__ */ jsx28(AuthError, { message: unavailableMessage, className: errorClassName }) });
  }
  const deleteUser = client.deleteUser;
  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    setFieldErrors({});
    if (confirmation !== "delete my account") {
      setFieldErrors({ confirm: mismatchMessage });
      return;
    }
    const validation = deleteAccountSchema.safeParse({ password });
    if (!validation.success) {
      const flattened = validation.error.flatten().fieldErrors;
      setFieldErrors({
        password: flattened.password?.[0]
      });
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await deleteUser({
        password: validation.data.password
      });
      if (response.error !== null) {
        setError(response.error.message ?? "Could not delete account.");
        return;
      }
      setSuccess(true);
      onSuccess?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not delete account."
      );
    } finally {
      setIsSubmitting(false);
    }
  }
  if (success) {
    return /* @__PURE__ */ jsx28(AuthCard, { className, title, description, children: /* @__PURE__ */ jsx28("p", { className: "text-center text-sm text-kumo-subtle", children: successMessage }) });
  }
  return /* @__PURE__ */ jsx28(AuthCard, { className, title, description, children: /* @__PURE__ */ jsxs26("form", { onSubmit: handleSubmit, className: "space-y-4", children: [
    /* @__PURE__ */ jsx28(AuthError, { message: error, className: errorClassName }),
    /* @__PURE__ */ jsx28(
      Input18,
      {
        label: passwordLabel,
        type: "password",
        value: password,
        onValueChange: setPassword,
        error: fieldErrors.password,
        autoComplete: "current-password",
        required: true
      }
    ),
    /* @__PURE__ */ jsx28(
      Input18,
      {
        label: confirmationLabel,
        value: confirmation,
        onValueChange: setConfirmation,
        placeholder: confirmationPlaceholder,
        error: fieldErrors.confirm,
        required: true
      }
    ),
    /* @__PURE__ */ jsx28(
      AuthSubmitButton,
      {
        loading: isSubmitting,
        className: "w-full",
        variant: "destructive",
        shape: "base",
        children: isSubmitting ? submittingLabel : submitLabel
      }
    )
  ] }) });
}

// src/forms/set-password-form.tsx
import { useState as useState26 } from "react";
import { Input as Input19 } from "@cloudflare/kumo/components/input";
import { z as z10 } from "zod";
import { jsx as jsx29, jsxs as jsxs27 } from "react/jsx-runtime";
var setPasswordSchema = z10.object({
  newPassword: z10.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z10.string().min(1, "Confirm your password")
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"]
});
function SetPasswordForm({
  title = "Set password",
  description = "Create a password so you can sign in with your email next time.",
  className,
  errorClassName,
  passwordLabel = "New password",
  confirmLabel = "Confirm password",
  submitLabel = "Set password",
  submittingLabel = "Saving\u2026",
  successMessage = "Your password has been set.",
  unavailableMessage = "Setting a password is not available.",
  onSuccess
}) {
  const client = useAuth();
  const [newPassword, setNewPassword] = useState26("");
  const [confirmPassword, setConfirmPassword] = useState26("");
  const [isSubmitting, setIsSubmitting] = useState26(false);
  const [error, setError] = useState26(null);
  const [success, setSuccess] = useState26(false);
  const [fieldErrors, setFieldErrors] = useState26(
    {}
  );
  if (client.setPassword === void 0) {
    return /* @__PURE__ */ jsx29(AuthCard, { className, title, description, children: /* @__PURE__ */ jsx29(AuthError, { message: unavailableMessage, className: errorClassName }) });
  }
  const setPassword = client.setPassword;
  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    setFieldErrors({});
    const validation = setPasswordSchema.safeParse({
      newPassword,
      confirmPassword
    });
    if (!validation.success) {
      const flattened = validation.error.flatten().fieldErrors;
      setFieldErrors({
        newPassword: flattened.newPassword?.[0],
        confirmPassword: flattened.confirmPassword?.[0]
      });
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await setPassword({
        newPassword: validation.data.newPassword
      });
      if (response.error !== null) {
        setError(response.error.message ?? "Could not set password.");
        return;
      }
      setSuccess(true);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not set password.");
    } finally {
      setIsSubmitting(false);
    }
  }
  if (success) {
    return /* @__PURE__ */ jsx29(AuthCard, { className, title, description, children: /* @__PURE__ */ jsx29("p", { className: "text-center text-sm text-kumo-subtle", children: successMessage }) });
  }
  return /* @__PURE__ */ jsx29(AuthCard, { className, title, description, children: /* @__PURE__ */ jsxs27("form", { onSubmit: handleSubmit, className: "space-y-4", children: [
    /* @__PURE__ */ jsx29(AuthError, { message: error, className: errorClassName }),
    /* @__PURE__ */ jsx29(
      Input19,
      {
        label: passwordLabel,
        type: "password",
        value: newPassword,
        onValueChange: setNewPassword,
        error: fieldErrors.newPassword,
        autoComplete: "new-password",
        required: true
      }
    ),
    /* @__PURE__ */ jsx29(
      Input19,
      {
        label: confirmLabel,
        type: "password",
        value: confirmPassword,
        onValueChange: setConfirmPassword,
        error: fieldErrors.confirmPassword,
        autoComplete: "new-password",
        required: true
      }
    ),
    /* @__PURE__ */ jsx29(
      AuthSubmitButton,
      {
        loading: isSubmitting,
        className: "w-full",
        shape: "base",
        children: isSubmitting ? submittingLabel : submitLabel
      }
    )
  ] }) });
}

// src/emails/index.ts
import { render } from "react-email";

// src/emails/email-layout.tsx
import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Section,
  Text as Text12
} from "react-email";
import { jsx as jsx30, jsxs as jsxs28 } from "react/jsx-runtime";
var defaultBrandColor = "#0052cc";
function EmailLayout({
  children,
  previewText,
  brandName = "Vortex",
  logoUrl,
  brandColor = defaultBrandColor
}) {
  return /* @__PURE__ */ jsxs28(Html, { children: [
    /* @__PURE__ */ jsx30(Head, {}),
    previewText ? /* @__PURE__ */ jsx30(Preview, { children: previewText }) : null,
    /* @__PURE__ */ jsx30(Body, { style: { backgroundColor: "#f6f7fb", margin: 0, padding: 0 }, children: /* @__PURE__ */ jsxs28(
      Container,
      {
        style: {
          maxWidth: "600px",
          margin: "0 auto",
          padding: "40px 20px",
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
        },
        children: [
          logoUrl ? /* @__PURE__ */ jsx30(Section, { style: { textAlign: "center", marginBottom: "24px" }, children: /* @__PURE__ */ jsx30(
            Img,
            {
              src: logoUrl,
              alt: brandName,
              width: "120",
              height: "auto",
              style: { margin: "0 auto" }
            }
          ) }) : /* @__PURE__ */ jsx30(Section, { style: { textAlign: "center", marginBottom: "24px" }, children: /* @__PURE__ */ jsx30(
            Text12,
            {
              style: {
                color: brandColor,
                fontSize: "24px",
                fontWeight: 700,
                margin: 0
              },
              children: brandName
            }
          ) }),
          /* @__PURE__ */ jsx30(
            Section,
            {
              style: {
                backgroundColor: "#ffffff",
                borderRadius: "8px",
                padding: "32px"
              },
              children
            }
          ),
          /* @__PURE__ */ jsxs28(
            Text12,
            {
              style: {
                color: "#6b7280",
                fontSize: "12px",
                textAlign: "center",
                marginTop: "24px"
              },
              children: [
                "\xA9 ",
                (/* @__PURE__ */ new Date()).getFullYear(),
                " ",
                brandName,
                ". All rights reserved."
              ]
            }
          )
        ]
      }
    ) })
  ] });
}

// src/emails/verification-email.tsx
import { Button as Button13, Heading, Text as Text13 } from "react-email";
import { jsx as jsx31, jsxs as jsxs29 } from "react/jsx-runtime";
function VerificationEmail({
  username,
  verificationUrl,
  previewText = "Verify your email address to get started.",
  heading = "Verify your email",
  message = "Thanks for signing up. Click the button below to verify your email address.",
  buttonText = "Verify email",
  fallbackMessage = "If the button doesn't work, copy and paste this link into your browser:",
  ...layoutProps
}) {
  return /* @__PURE__ */ jsxs29(EmailLayout, { previewText, ...layoutProps, children: [
    /* @__PURE__ */ jsx31(
      Heading,
      {
        as: "h1",
        style: { color: "#111827", fontSize: "24px", fontWeight: 700 },
        children: heading
      }
    ),
    username ? /* @__PURE__ */ jsxs29(Text13, { style: { color: "#374151", fontSize: "16px" }, children: [
      "Hi ",
      username,
      ","
    ] }) : null,
    /* @__PURE__ */ jsx31(Text13, { style: { color: "#374151", fontSize: "16px", lineHeight: "1.5" }, children: message }),
    /* @__PURE__ */ jsx31(
      Button13,
      {
        href: verificationUrl,
        style: {
          backgroundColor: layoutProps.brandColor ?? "#0052cc",
          color: "#ffffff",
          borderRadius: "6px",
          padding: "12px 24px",
          fontSize: "16px",
          fontWeight: 600,
          textDecoration: "none",
          display: "inline-block",
          marginTop: "8px",
          marginBottom: "8px"
        },
        children: buttonText
      }
    ),
    /* @__PURE__ */ jsxs29(Text13, { style: { color: "#6b7280", fontSize: "14px", lineHeight: "1.5" }, children: [
      fallbackMessage,
      /* @__PURE__ */ jsx31("br", {}),
      /* @__PURE__ */ jsx31(
        "a",
        {
          href: verificationUrl,
          style: { color: layoutProps.brandColor ?? "#0052cc" },
          children: verificationUrl
        }
      )
    ] })
  ] });
}

// src/emails/password-reset-email.tsx
import { Button as Button14, Heading as Heading2, Text as Text14 } from "react-email";
import { jsx as jsx32, jsxs as jsxs30 } from "react/jsx-runtime";
function PasswordResetEmail({
  username,
  resetUrl,
  previewText = "Reset your password.",
  heading = "Reset your password",
  message = "We received a request to reset your password. Click the button below to choose a new one.",
  buttonText = "Reset password",
  fallbackMessage = "If the button doesn't work, copy and paste this link into your browser:",
  expiryMessage = "This link will expire in a short while for your security.",
  ...layoutProps
}) {
  return /* @__PURE__ */ jsxs30(EmailLayout, { previewText, ...layoutProps, children: [
    /* @__PURE__ */ jsx32(
      Heading2,
      {
        as: "h1",
        style: { color: "#111827", fontSize: "24px", fontWeight: 700 },
        children: heading
      }
    ),
    username ? /* @__PURE__ */ jsxs30(Text14, { style: { color: "#374151", fontSize: "16px" }, children: [
      "Hi ",
      username,
      ","
    ] }) : null,
    /* @__PURE__ */ jsx32(Text14, { style: { color: "#374151", fontSize: "16px", lineHeight: "1.5" }, children: message }),
    /* @__PURE__ */ jsx32(
      Button14,
      {
        href: resetUrl,
        style: {
          backgroundColor: layoutProps.brandColor ?? "#0052cc",
          color: "#ffffff",
          borderRadius: "6px",
          padding: "12px 24px",
          fontSize: "16px",
          fontWeight: 600,
          textDecoration: "none",
          display: "inline-block",
          marginTop: "8px",
          marginBottom: "8px"
        },
        children: buttonText
      }
    ),
    /* @__PURE__ */ jsxs30(Text14, { style: { color: "#6b7280", fontSize: "14px", lineHeight: "1.5" }, children: [
      fallbackMessage,
      /* @__PURE__ */ jsx32("br", {}),
      /* @__PURE__ */ jsx32(
        "a",
        {
          href: resetUrl,
          style: { color: layoutProps.brandColor ?? "#0052cc" },
          children: resetUrl
        }
      )
    ] }),
    /* @__PURE__ */ jsx32(Text14, { style: { color: "#6b7280", fontSize: "14px" }, children: expiryMessage })
  ] });
}

// src/emails/organization-invitation-email.tsx
import { Button as Button15, Heading as Heading3, Text as Text15 } from "react-email";
import { jsx as jsx33, jsxs as jsxs31 } from "react/jsx-runtime";
function OrganizationInvitationEmail({
  inviterName,
  organizationName,
  acceptUrl,
  previewText = `You've been invited to join ${organizationName}.`,
  heading = "You're invited to join a workspace",
  message = `You've been invited to join ${organizationName}${inviterName ? ` by ${inviterName}` : ""}. Click the button below to accept the invitation and get started.`,
  buttonText = "Accept invitation",
  fallbackMessage = "If the button doesn't work, copy and paste this link into your browser:",
  ...layoutProps
}) {
  return /* @__PURE__ */ jsxs31(EmailLayout, { previewText, ...layoutProps, children: [
    /* @__PURE__ */ jsx33(
      Heading3,
      {
        as: "h1",
        style: { color: "#111827", fontSize: "24px", fontWeight: 700 },
        children: heading
      }
    ),
    /* @__PURE__ */ jsx33(Text15, { style: { color: "#374151", fontSize: "16px", lineHeight: "1.5" }, children: message }),
    /* @__PURE__ */ jsx33(
      Button15,
      {
        href: acceptUrl,
        style: {
          backgroundColor: layoutProps.brandColor ?? "#0052cc",
          color: "#ffffff",
          borderRadius: "6px",
          padding: "12px 24px",
          fontSize: "16px",
          fontWeight: 600,
          textDecoration: "none",
          display: "inline-block",
          marginTop: "8px",
          marginBottom: "8px"
        },
        children: buttonText
      }
    ),
    /* @__PURE__ */ jsxs31(Text15, { style: { color: "#6b7280", fontSize: "14px", lineHeight: "1.5" }, children: [
      fallbackMessage,
      /* @__PURE__ */ jsx33("br", {}),
      /* @__PURE__ */ jsx33(
        "a",
        {
          href: acceptUrl,
          style: { color: layoutProps.brandColor ?? "#0052cc" },
          children: acceptUrl
        }
      )
    ] })
  ] });
}

// src/emails/change-email-confirmation.tsx
import { Button as Button16, Heading as Heading4, Text as Text16 } from "react-email";
import { jsx as jsx34, jsxs as jsxs32 } from "react/jsx-runtime";
function ChangeEmailConfirmation({
  username,
  newEmail,
  confirmUrl,
  previewText = "Confirm your new email address.",
  heading = "Confirm your new email",
  message = `A request was made to change your email address to ${newEmail}. Click the button below to confirm this change.`,
  buttonText = "Confirm email change",
  fallbackMessage = "If the button doesn't work, copy and paste this link into your browser:",
  ...layoutProps
}) {
  return /* @__PURE__ */ jsxs32(EmailLayout, { previewText, ...layoutProps, children: [
    /* @__PURE__ */ jsx34(
      Heading4,
      {
        as: "h1",
        style: { color: "#111827", fontSize: "24px", fontWeight: 700 },
        children: heading
      }
    ),
    username ? /* @__PURE__ */ jsxs32(Text16, { style: { color: "#374151", fontSize: "16px" }, children: [
      "Hi ",
      username,
      ","
    ] }) : null,
    /* @__PURE__ */ jsx34(Text16, { style: { color: "#374151", fontSize: "16px", lineHeight: "1.5" }, children: message }),
    /* @__PURE__ */ jsx34(
      Button16,
      {
        href: confirmUrl,
        style: {
          backgroundColor: layoutProps.brandColor ?? "#0052cc",
          color: "#ffffff",
          borderRadius: "6px",
          padding: "12px 24px",
          fontSize: "16px",
          fontWeight: 600,
          textDecoration: "none",
          display: "inline-block",
          marginTop: "8px",
          marginBottom: "8px"
        },
        children: buttonText
      }
    ),
    /* @__PURE__ */ jsxs32(Text16, { style: { color: "#6b7280", fontSize: "14px", lineHeight: "1.5" }, children: [
      fallbackMessage,
      /* @__PURE__ */ jsx34("br", {}),
      /* @__PURE__ */ jsx34(
        "a",
        {
          href: confirmUrl,
          style: { color: layoutProps.brandColor ?? "#0052cc" },
          children: confirmUrl
        }
      )
    ] })
  ] });
}

// src/emails/welcome-email.tsx
import { Button as Button17, Heading as Heading5, Text as Text17 } from "react-email";
import { jsx as jsx35, jsxs as jsxs33 } from "react/jsx-runtime";
function WelcomeEmail({
  username,
  getStartedUrl,
  previewText = "Welcome \u2014 let's get you started.",
  heading = "Welcome aboard",
  message = "Thanks for joining. Click the button below to get started with your account.",
  buttonText = "Get started",
  ...layoutProps
}) {
  return /* @__PURE__ */ jsxs33(EmailLayout, { previewText, ...layoutProps, children: [
    /* @__PURE__ */ jsx35(
      Heading5,
      {
        as: "h1",
        style: { color: "#111827", fontSize: "24px", fontWeight: 700 },
        children: heading
      }
    ),
    username ? /* @__PURE__ */ jsxs33(Text17, { style: { color: "#374151", fontSize: "16px" }, children: [
      "Hi ",
      username,
      ","
    ] }) : null,
    /* @__PURE__ */ jsx35(Text17, { style: { color: "#374151", fontSize: "16px", lineHeight: "1.5" }, children: message }),
    /* @__PURE__ */ jsx35(
      Button17,
      {
        href: getStartedUrl,
        style: {
          backgroundColor: layoutProps.brandColor ?? "#0052cc",
          color: "#ffffff",
          borderRadius: "6px",
          padding: "12px 24px",
          fontSize: "16px",
          fontWeight: 600,
          textDecoration: "none",
          display: "inline-block",
          marginTop: "8px",
          marginBottom: "8px"
        },
        children: buttonText
      }
    )
  ] });
}

// src/emails/password-changed-email.tsx
import { Heading as Heading6, Text as Text18 } from "react-email";
import { jsx as jsx36, jsxs as jsxs34 } from "react/jsx-runtime";
function PasswordChangedEmail({
  username,
  previewText = "Your password was changed.",
  heading = "Password changed",
  message = "Your password was successfully changed. If you didn't make this change, contact support immediately.",
  footerMessage = "If you didn't request this change, you should secure your account right away.",
  ...layoutProps
}) {
  return /* @__PURE__ */ jsxs34(EmailLayout, { previewText, ...layoutProps, children: [
    /* @__PURE__ */ jsx36(
      Heading6,
      {
        as: "h1",
        style: { color: "#111827", fontSize: "24px", fontWeight: 700 },
        children: heading
      }
    ),
    username ? /* @__PURE__ */ jsxs34(Text18, { style: { color: "#374151", fontSize: "16px" }, children: [
      "Hi ",
      username,
      ","
    ] }) : null,
    /* @__PURE__ */ jsx36(Text18, { style: { color: "#374151", fontSize: "16px", lineHeight: "1.5" }, children: message }),
    /* @__PURE__ */ jsx36(Text18, { style: { color: "#6b7280", fontSize: "14px", lineHeight: "1.5" }, children: footerMessage })
  ] });
}

// src/emails/magic-link-email.tsx
import { Button as Button18, Heading as Heading7, Text as Text19 } from "react-email";
import { jsx as jsx37, jsxs as jsxs35 } from "react/jsx-runtime";
function MagicLinkEmail({
  username,
  signInUrl,
  previewText = "Sign in to your account.",
  heading = "Sign in to your account",
  message = "Click the button below to sign in. This link will expire shortly.",
  buttonText = "Sign in",
  fallbackMessage = "If the button doesn't work, copy and paste this link into your browser:",
  ...layoutProps
}) {
  return /* @__PURE__ */ jsxs35(EmailLayout, { previewText, ...layoutProps, children: [
    /* @__PURE__ */ jsx37(
      Heading7,
      {
        as: "h1",
        style: { color: "#111827", fontSize: "24px", fontWeight: 700 },
        children: heading
      }
    ),
    username ? /* @__PURE__ */ jsxs35(Text19, { style: { color: "#374151", fontSize: "16px" }, children: [
      "Hi ",
      username,
      ","
    ] }) : null,
    /* @__PURE__ */ jsx37(Text19, { style: { color: "#374151", fontSize: "16px", lineHeight: "1.5" }, children: message }),
    /* @__PURE__ */ jsx37(
      Button18,
      {
        href: signInUrl,
        style: {
          backgroundColor: layoutProps.brandColor ?? "#0052cc",
          color: "#ffffff",
          borderRadius: "6px",
          padding: "12px 24px",
          fontSize: "16px",
          fontWeight: 600,
          textDecoration: "none",
          display: "inline-block",
          marginTop: "8px",
          marginBottom: "8px"
        },
        children: buttonText
      }
    ),
    /* @__PURE__ */ jsxs35(Text19, { style: { color: "#6b7280", fontSize: "14px", lineHeight: "1.5" }, children: [
      fallbackMessage,
      /* @__PURE__ */ jsx37("br", {}),
      /* @__PURE__ */ jsx37(
        "a",
        {
          href: signInUrl,
          style: { color: layoutProps.brandColor ?? "#0052cc" },
          children: signInUrl
        }
      )
    ] })
  ] });
}
export {
  AcceptInviteScreen,
  AuthCard,
  AuthDivider,
  AuthError,
  AuthLoading,
  AuthProvider,
  AuthProviderButtons,
  AuthSubmitButton,
  Authenticated,
  ChangeEmailConfirmation,
  ChangeEmailForm,
  ChangePasswordForm,
  ConnectedAccounts,
  CreateOrganizationForm,
  DeleteAccountForm,
  DisableTwoFactorForm,
  EmailLayout,
  EnableTwoFactorForm,
  ForgotPasswordForm,
  GenerateBackupCodesForm,
  InviteMemberForm,
  MagicLinkEmail,
  MagicLinkSignInForm,
  MagicLinkVerify,
  OrganizationInvitationEmail,
  OrganizationList,
  OrganizationMembers,
  OrganizationProfile,
  OrganizationSwitcher,
  PasswordChangedEmail,
  PasswordResetEmail,
  ResetPasswordForm,
  SessionList,
  SetPasswordForm,
  SignInForm,
  SignOutButton,
  SignUpForm,
  Unauthenticated,
  UserButton,
  UserProfileForm,
  VerificationEmail,
  VerifyBackupCodeForm,
  VerifyEmailForm,
  VerifyTotpForm,
  WelcomeEmail,
  render,
  useAuth
};
