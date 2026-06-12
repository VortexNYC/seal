import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = new URL("..", import.meta.url).pathname;
const overviewRoutePath = "apps/web/src/routes/_authenticated/$slug/payments/index.tsx";
const subscriptionsRoutePath =
  "apps/web/src/routes/_authenticated/$slug/payments/subscriptions.tsx";
const documentRoutePath = "apps/web/src/routes/_authenticated/$slug/documents/$documentId.tsx";
const documentSidebarPath = "apps/web/src/components/documents/document-sidebar.tsx";
const fieldToolbarPath = "apps/web/src/components/documents/field-toolbar.tsx";
const paymentsQueriesPath = "apps/backend/convex/payments/queries.ts";
const paymentsSubscriptionActionsPath = "apps/backend/convex/payments/subscription_actions.ts";
const paymentsPaymentFieldActionsPath = "apps/backend/convex/payments/payment_field_actions.ts";
const paymentsMerchantAccountActionsPath =
  "apps/backend/convex/payments/merchant_account_actions.ts";
const providerPaymentFieldActionsPath = "apps/backend/convex/stripe/payment_field_actions.ts";
const providerConnectActionsPath = "apps/backend/convex/stripe/connect_actions.ts";
const generatedApiPath = "apps/backend/convex/_generated/api.d.ts";
const billingE2ePath = "apps/web/e2e/tests/billing.e2e.ts";
const deletedProviderBillingQueriesPath = "apps/backend/convex/stripe/queries.ts";
const deletedProviderSubscriptionActionsPath =
  "apps/backend/convex/stripe/connect_subscription_actions.ts";
const failures: string[] = [];

for (const requiredPath of [
  paymentsQueriesPath,
  paymentsSubscriptionActionsPath,
  paymentsPaymentFieldActionsPath,
  paymentsMerchantAccountActionsPath,
  providerPaymentFieldActionsPath,
  providerConnectActionsPath,
  generatedApiPath,
  billingE2ePath,
]) {
  if (!existsSync(join(repoRoot, requiredPath))) {
    failures.push(`${requiredPath} must exist as the Vortex-owned backend payments API.`);
  }
}

if (existsSync(join(repoRoot, deletedProviderBillingQueriesPath))) {
  failures.push(
    `${deletedProviderBillingQueriesPath} must stay deleted; billing plans enter through api.payments.`,
  );
}

if (existsSync(join(repoRoot, deletedProviderSubscriptionActionsPath))) {
  failures.push(
    `${deletedProviderSubscriptionActionsPath} must stay deleted; subscriptions enter through api.payments.`,
  );
}

const overviewRoute = readFileSync(join(repoRoot, overviewRoutePath), "utf8");
const subscriptionsRoute = readFileSync(join(repoRoot, subscriptionsRoutePath), "utf8");
const documentRoute = readFileSync(join(repoRoot, documentRoutePath), "utf8");
const documentSidebar = readFileSync(join(repoRoot, documentSidebarPath), "utf8");
const fieldToolbar = readFileSync(join(repoRoot, fieldToolbarPath), "utf8");
const paymentsQueries = readFileSync(join(repoRoot, paymentsQueriesPath), "utf8");
const paymentsSubscriptionActions = readFileSync(
  join(repoRoot, paymentsSubscriptionActionsPath),
  "utf8",
);
const paymentsPaymentFieldActions = readFileSync(
  join(repoRoot, paymentsPaymentFieldActionsPath),
  "utf8",
);
const paymentsMerchantAccountActions = readFileSync(
  join(repoRoot, paymentsMerchantAccountActionsPath),
  "utf8",
);
const providerPaymentFieldActions = readFileSync(
  join(repoRoot, providerPaymentFieldActionsPath),
  "utf8",
);
const providerConnectActions = readFileSync(join(repoRoot, providerConnectActionsPath), "utf8");
const generatedApi = readFileSync(join(repoRoot, generatedApiPath), "utf8");
const billingE2e = readFileSync(join(repoRoot, billingE2ePath), "utf8");

for (const requiredFragment of [
  "api.payments.queries.getRevenueStats",
  "api.payments.queries.getTransactionList",
]) {
  if (!overviewRoute.includes(requiredFragment)) {
    failures.push(`${overviewRoutePath} missing Vortex backend fragment: ${requiredFragment}`);
  }
}

for (const requiredFragment of [
  "api.payments.queries.getActiveSubscriptions",
  "api.payments.subscription_actions.pauseSubscription",
  "api.payments.subscription_actions.resumeSubscription",
  "api.payments.subscription_actions.cancelSubscription",
  "processorSubscriptionId",
]) {
  if (!subscriptionsRoute.includes(requiredFragment)) {
    failures.push(`${subscriptionsRoutePath} missing Vortex backend fragment: ${requiredFragment}`);
  }
}

for (const forbiddenFragment of [
  "api.stripe.revenue_queries",
  "api.stripe.subscription_queries",
  "api.stripe.connect_subscription_actions",
  "stripeAccountId",
  "stripeSubscriptionId",
]) {
  if (overviewRoute.includes(forbiddenFragment) || subscriptionsRoute.includes(forbiddenFragment)) {
    failures.push(
      `payment routes still expose Stripe backend adapter fragment: ${forbiddenFragment}`,
    );
  }
}

for (const [sourcePath, source] of [
  [documentRoutePath, documentRoute],
  [documentSidebarPath, documentSidebar],
  [fieldToolbarPath, fieldToolbar],
] as const) {
  if (!source.includes("merchantPaymentsReady")) {
    failures.push(`${sourcePath} must use merchantPaymentsReady for document payment readiness.`);
  }

  if (source.includes("stripeConnected")) {
    failures.push(`${sourcePath} still exposes Stripe payment readiness naming.`);
  }
}

for (const requiredFragment of [
  "export const getRevenueStats = memberQuery",
  "export const getTransactionList = memberQuery",
  "export const getActiveSubscriptions = memberQuery",
  "export const resolveSubscriptionProcessorContext = internalQuery",
  "getAuthContext",
  "payment_field_configs",
  "document_invoices",
]) {
  if (!paymentsQueries.includes(requiredFragment)) {
    failures.push(
      `${paymentsQueriesPath} missing Vortex backend query fragment: ${requiredFragment}`,
    );
  }
}

for (const requiredFragment of [
  "export const pauseSubscription = action",
  "export const resumeSubscription = action",
  "export const cancelSubscription = action",
  "resolveSubscriptionProcessorContext",
  "processor.processorAccountId",
]) {
  if (!paymentsSubscriptionActions.includes(requiredFragment)) {
    failures.push(
      `${paymentsSubscriptionActionsPath} missing Vortex action fragment: ${requiredFragment}`,
    );
  }
}

if (paymentsSubscriptionActions.includes("stripeAccountId: v.string()")) {
  failures.push(
    "Vortex subscription actions must not accept processor account ids from the browser.",
  );
}

if (generatedApi.includes("stripe/connect_subscription_actions")) {
  failures.push("Generated Convex API still exposes deleted provider subscription actions.");
}

if (generatedApi.includes("stripe/queries")) {
  failures.push("Generated Convex API still exposes deleted provider billing queries.");
}

if (!billingE2e.includes("api.payments.billing_queries.getAvailablePlans")) {
  failures.push(
    `${billingE2ePath} must prove available plans through api.payments billing queries.`,
  );
}

if (billingE2e.includes("api.stripe.queries")) {
  failures.push(`${billingE2ePath} still calls public Stripe billing queries.`);
}

for (const requiredFragment of [
  "internal.stripe.payment_field_actions.createProviderPaymentObjectsForDocumentFields",
  "type ProviderPaymentLink",
  "providerInvoiceId",
  "processorInvoiceId",
]) {
  if (!paymentsPaymentFieldActions.includes(requiredFragment)) {
    failures.push(
      `${paymentsPaymentFieldActionsPath} missing Vortex payment object boundary fragment: ${requiredFragment}`,
    );
  }
}

for (const forbiddenFragment of [
  "createStripePaymentObjectsForDocumentFields",
  "type StripeInvoiceLink",
  "type StripePaymentObjectsResult",
]) {
  if (paymentsPaymentFieldActions.includes(forbiddenFragment)) {
    failures.push(
      `${paymentsPaymentFieldActionsPath} still exposes Stripe-shaped payment object fragment: ${forbiddenFragment}`,
    );
  }
}

for (const requiredFragment of [
  "export const createProviderPaymentObjectsForDocumentFields = internalAction",
  "paymentLinks:",
  "providerInvoiceId:",
]) {
  if (!providerPaymentFieldActions.includes(requiredFragment)) {
    failures.push(
      `${providerPaymentFieldActionsPath} missing internal provider payment object fragment: ${requiredFragment}`,
    );
  }
}

if (providerPaymentFieldActions.includes("createStripePaymentObjectsForDocumentFields")) {
  failures.push("Internal provider payment field action must use provider-neutral export naming.");
}

for (const requiredFragment of [
  "internal.stripe.connect_actions.createConnectedAccount",
  "internal.stripe.connect_actions.createAccountLink",
  "internal.stripe.connect_actions.createConnectOAuthUrl",
  "internal.stripe.connect_actions.exchangeConnectOAuthCode",
  "internal.stripe.connect_actions.createAccountSession",
  "internal.stripe.connect_actions.refreshConnectedAccount",
]) {
  if (!paymentsMerchantAccountActions.includes(requiredFragment)) {
    failures.push(
      `${paymentsMerchantAccountActionsPath} missing internal provider fragment: ${requiredFragment}`,
    );
  }
}

if (paymentsMerchantAccountActions.includes("api.stripe.connect_actions")) {
  failures.push("Vortex merchant account actions must not call public provider connect actions.");
}

for (const providerActionName of [
  "createConnectedAccount",
  "createAccountLink",
  "createConnectOAuthUrl",
  "exchangeConnectOAuthCode",
  "createAccountSession",
  "refreshConnectedAccount",
]) {
  if (providerConnectActions.includes(`export const ${providerActionName} = action({`)) {
    failures.push(
      `${providerConnectActionsPath} must keep ${providerActionName} internal-only behind Vortex Payments.`,
    );
  }
}

if (failures.length > 0) {
  console.error("Vortex payments backend adapter adoption proof failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Vortex payments backend adapter adoption proof passed:");
console.log("- Payment overview reads from api.payments queries, not api.stripe revenue queries.");
console.log("- Subscription route reads and writes through api.payments.");
console.log("- Browser no longer supplies processor account ids for subscription operations.");
console.log("- Vortex subscription actions resolve processor context server-side.");
console.log("- Vortex Connect account operations enter through api.payments merchant actions.");
console.log(
  "- Dead public provider subscription actions stay deleted from source and generated API.",
);
console.log("- Document payment object creation uses Vortex-owned payment link naming.");
console.log("- Available billing plans enter through api.payments billing queries.");
