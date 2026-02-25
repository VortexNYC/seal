import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/$slug/payments")({
  component: PaymentsLayout,
});

function PaymentsLayout() {
  return <Outlet />;
}
