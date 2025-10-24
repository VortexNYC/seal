import { ConvexQueryClient } from "@convex-dev/react-query";
import { ConvexProvider } from "convex/react";

interface ImportMetaEnv {
	readonly VITE_CONVEX_URL: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

const CONVEX_URL = (import.meta as ImportMeta).env.VITE_CONVEX_URL;
if (!CONVEX_URL) {
	console.error("missing envar CONVEX_URL");
}
const convexQueryClient = new ConvexQueryClient(CONVEX_URL);

export default function AppConvexProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<ConvexProvider client={convexQueryClient.convexClient}>
			{children}
		</ConvexProvider>
	);
}
