export type ContactStatus = "active" | "inactive" | "lead";

const CONTACT_STATUSES: readonly ContactStatus[] = [
  "active",
  "inactive",
  "lead",
];

export function isContactStatus(status: string): status is ContactStatus {
  return CONTACT_STATUSES.some((valid) => valid === status);
}

export function toContactStatus(status: string): ContactStatus {
  return isContactStatus(status) ? status : "active";
}
