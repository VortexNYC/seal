type WaitingRecipient = {
  id: string;
  name?: string | null;
  email: string;
  role: string;
  order: number;
  status: string;
};

const OPEN_STATUS = new Set(["pending", "viewed"]);
const SIGNING_ROLE = new Set(["signer", "approver"]);

function personLabel(recipient: WaitingRecipient): string {
  const name = recipient.name?.trim();
  return name && name.length > 0 ? name : recipient.email;
}

function joinPeople(labels: readonly string[]): string | null {
  const first = labels[0];
  if (!first) return null;
  if (labels.length === 1) return first;
  const second = labels[1];
  if (labels.length === 2 && second) return `${first} and ${second}`;
  return `${first} and ${labels.length - 1} others`;
}

/** Who the sender is waiting on, including the next sequential email. */
export function envelopeWaitingDetail(
  signingMode: string | null | undefined,
  recipients: readonly WaitingRecipient[]
): string {
  const parties = recipients.filter((recipient) =>
    SIGNING_ROLE.has(recipient.role)
  );
  const declined = parties.find((recipient) => recipient.status === "declined");
  if (declined) return `${personLabel(declined)} declined.`;

  const open = parties.filter((recipient) => OPEN_STATUS.has(recipient.status));
  if (open.length === 0) {
    return "Waiting on the next step in this envelope.";
  }

  let due = open;
  if (signingMode === "sequential") {
    let current: number | null = null;
    for (const recipient of open) {
      if (current === null || recipient.order < current) {
        current = recipient.order;
      }
    }
    due = open.filter((recipient) => recipient.order === current);
  }

  const names = joinPeople(due.map(personLabel));
  if (!names) return "Waiting on the next step in this envelope.";

  let sentence = `Waiting on ${names}.`;
  if (signingMode !== "sequential") return sentence;

  const currentOrder = due[0]?.order;
  if (currentOrder === undefined) return sentence;
  const later = open.filter((recipient) => recipient.order > currentOrder);
  let nextOrder: number | null = null;
  for (const recipient of later) {
    if (nextOrder === null || recipient.order < nextOrder) {
      nextOrder = recipient.order;
    }
  }
  const next = later.filter((recipient) => recipient.order === nextOrder);
  const nextNames = joinPeople(next.map(personLabel));
  if (!nextNames) return sentence;
  const verb = next.length === 1 ? "gets" : "get";
  return `${sentence} ${nextNames} ${verb} the email after that.`;
}
