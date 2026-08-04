export type Env = {
  readonly [key: string]: string | undefined;
};

export type SaasBillingProvider = "vortex_billing";

export function selectSaasBillingProvider(
  _organizationId: string,
  _env: Env = process.env
): SaasBillingProvider {
  return "vortex_billing";
}
