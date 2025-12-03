import type { ErrorComponentProps } from "@tanstack/react-router";
import { Link, rootRouteId, useMatch, useRouter } from "@tanstack/react-router";
import { AlertCircle, Home, RefreshCw, Undo2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
	const router = useRouter();
	const cardRef = useRef<HTMLDivElement>(null);
	const isRoot = useMatch({
		strict: false,
		select: (state) => state.id === rootRouteId,
	});

	console.error(error);

	const errorMessage =
		error instanceof Error ? error.message : "An unexpected error occurred";
	const errorStack = error instanceof Error ? error.stack : undefined;

	// Focus management: move focus to the error card when it appears
	useEffect(() => {
		if (cardRef.current) {
			cardRef.current.focus();
		}
	}, []);

	return (
		<div
			className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8"
			role="alert"
			aria-live="assertive"
		>
			<Card
				ref={cardRef}
				tabIndex={-1}
				className="w-full max-w-2xl focus:outline-none"
			>
				<CardHeader className="text-center">
					<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
						<AlertCircle className="h-6 w-6 text-destructive" />
					</div>
					<CardTitle className="text-2xl">Something went wrong</CardTitle>
					<CardDescription>
						We encountered an error while processing your request
					</CardDescription>
				</CardHeader>

				<CardContent className="space-y-4">
					<Alert variant="destructive">
						<AlertCircle className="h-4 w-4" />
						<AlertTitle>Error Details</AlertTitle>
						<AlertDescription className="mt-2 font-mono text-xs">
							{errorMessage}
						</AlertDescription>
					</Alert>

					{errorStack && import.meta.env.DEV && (
						<details className="rounded-lg border p-4">
							<summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
								View stack trace (development only)
							</summary>
							<pre className="mt-2 overflow-x-auto text-xs text-muted-foreground">
								{errorStack}
							</pre>
						</details>
					)}
				</CardContent>

				<CardFooter className="flex flex-col sm:flex-row gap-2">
					<Button
						onClick={() => router.invalidate()}
						className="w-full sm:w-auto"
						variant="default"
					>
						<RefreshCw className="mr-2 h-4 w-4" />
						Try Again
					</Button>

					{isRoot ? (
						<Button asChild variant="outline" className="w-full sm:w-auto">
							<Link to="/">
								<Home className="mr-2 h-4 w-4" />
								Go Home
							</Link>
						</Button>
					) : (
						<Button
							asChild
							variant="outline"
							className="w-full sm:w-auto"
							onClick={(e) => {
								e.preventDefault();
								window.history.back();
							}}
						>
							<Link to="/">
								<Undo2 className="mr-2 h-4 w-4" />
								Go Back
							</Link>
						</Button>
					)}
				</CardFooter>
			</Card>
		</div>
	);
}
