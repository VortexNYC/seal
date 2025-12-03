import {
	type ErrorComponentProps,
	Link,
	useRouter,
} from "@tanstack/react-router";
import {
	AlertTriangleIcon,
	HomeIcon,
	MailIcon,
	RefreshCwIcon,
} from "lucide-react";
import { Button } from "./ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "./ui/card";

/**
 * Route-level error component for TanStack Router
 *
 * This component is used when a route throws an error during loading or rendering.
 * It provides options to retry, go home, or contact support.
 */
export function RouteErrorComponent({ error, reset }: ErrorComponentProps) {
	const router = useRouter();
	const isDev = import.meta.env.DEV;

	const errorMessage =
		error instanceof Error ? error.message : "An unexpected error occurred";
	const errorStack = error instanceof Error ? error.stack : undefined;

	const handleRetry = () => {
		// First reset the error boundary state
		reset();
		// Then invalidate and reload the current route
		router.invalidate();
	};

	return (
		<div className="flex min-h-svh items-center justify-center bg-background p-4">
			<Card className="w-full max-w-lg">
				<CardHeader className="text-center">
					<div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-destructive/10">
						<AlertTriangleIcon className="size-8 text-destructive" />
					</div>
					<CardTitle className="text-2xl">Something went wrong</CardTitle>
					<CardDescription className="text-base">
						We encountered an error while loading this page. Please try again or
						return to the home page.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="rounded-lg bg-muted p-4 text-center">
						<p className="text-sm text-muted-foreground">
							If the problem persists, please contact our support team for
							assistance.
						</p>
					</div>

					{isDev && (
						<div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
							<p className="mb-2 text-sm font-medium text-destructive">
								Error Details (Development Only):
							</p>
							<pre className="overflow-auto text-xs text-muted-foreground">
								{errorMessage}
							</pre>
							{errorStack && (
								<details className="mt-2">
									<summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
										Stack trace
									</summary>
									<pre className="mt-2 overflow-auto text-xs text-muted-foreground">
										{errorStack}
									</pre>
								</details>
							)}
						</div>
					)}
				</CardContent>
				<CardFooter className="flex flex-col gap-3 sm:flex-row">
					<Button
						onClick={handleRetry}
						variant="default"
						className="w-full sm:w-auto"
					>
						<RefreshCwIcon className="size-4" />
						Try Again
					</Button>
					<Button asChild variant="outline" className="w-full sm:w-auto">
						<Link to="/">
							<HomeIcon className="size-4" />
							Go to Home
						</Link>
					</Button>
					<Button asChild variant="ghost" className="w-full sm:w-auto">
						<a href="mailto:support@seal.nyc">
							<MailIcon className="size-4" />
							Contact Support
						</a>
					</Button>
				</CardFooter>
			</Card>
		</div>
	);
}
