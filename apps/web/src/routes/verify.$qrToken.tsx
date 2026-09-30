/**
 * Public Document Verification Page
 * Route: /verify/$qrToken
 *
 * Anyone can scan the QR code on a completion certificate and land here
 * to verify the document is authentic. No login required.
 */

import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { VerifyFailed, VerifySuccess } from "@/components/verify-card";
import { verifyDocumentByQrToken } from "@/lib/api-client";
import {
  muteGuestAnalytics,
  useGuestAnalyticsMute,
} from "@/lib/guest-analytics";

export const Route = createFileRoute("/verify/$qrToken")({
  beforeLoad: () => {
    muteGuestAnalytics();
  },
  component: VerifyPage,
});

function VerifyPage() {
  useGuestAnalyticsMute();
  const { qrToken } = Route.useParams();
  const { data: result } = useSuspenseQuery({
    queryKey: ["verify", qrToken],
    queryFn: () => verifyDocumentByQrToken(qrToken),
  });

  if (!result) {
    return <VerifyFailed />;
  }

  return <VerifySuccess result={result} />;
}
