export type ActivityEventType =
  | "created"
  | "recipient_added"
  | "sent"
  | "viewed"
  | "signed"
  | "approved"
  | "declined"
  | "completed"
  | "cancelled";

export type ActivityEvent = {
  type: ActivityEventType;
  timestamp: number;
  description: string;
};

type DocumentData = {
  name: string;
  createdAt: number;
};

type Recipient = {
  createdAt: number;
  email: string;
  name?: string | null;
  role: string;
  viewedAt?: number | null;
  signedAt?: number | null;
  approvedAt?: number | null;
  declinedAt?: number | null;
};

/**
 * Builds a sorted (newest-first) list of activity events from document and recipient data.
 */
export function buildActivityEvents(
  documentData: DocumentData,
  recipients: Recipient[]
): ActivityEvent[] {
  const events: ActivityEvent[] = [];

  events.push({
    type: "created",
    timestamp: documentData.createdAt,
    description: `Document "${documentData.name}" was created`,
  });

  for (const recipient of recipients) {
    events.push({
      type: "recipient_added",
      timestamp: recipient.createdAt,
      description: `${recipient.name || recipient.email} was added as a ${recipient.role}`,
    });

    if (recipient.viewedAt) {
      events.push({
        type: "viewed",
        timestamp: recipient.viewedAt,
        description: `${recipient.name || recipient.email} viewed the document`,
      });
    }

    if (recipient.signedAt) {
      events.push({
        type: "signed",
        timestamp: recipient.signedAt,
        description: `${recipient.name || recipient.email} signed the document`,
      });
    }

    if (recipient.approvedAt) {
      events.push({
        type: "approved",
        timestamp: recipient.approvedAt,
        description: `${recipient.name || recipient.email} approved the document`,
      });
    }

    if (recipient.declinedAt) {
      events.push({
        type: "declined",
        timestamp: recipient.declinedAt,
        description: `${recipient.name || recipient.email} declined`,
      });
    }
  }

  return events.sort((a, b) => b.timestamp - a.timestamp);
}
