import { Link } from "@tanstack/react-router";
import { Home, Mail, RefreshCw, ServerCrash } from "lucide-react";
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
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface ServerErrorProps {
	error?: Error | unknown;
	onRetry?: () => void;
}

export function ServerError({ error, onRetry }: ServerErrorProps) {
	const errorMessage =
		error instanceof Error
			? error.message
			: "The server encountered an error and could not complete your request";
	const errorStack = error instanceof Error ? error.stack : undefined;

	return (
		<div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8">
			<Card className="w-full max-w-2xl">
				<CardHeader className="text-center">
					<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
						<ServerCrash className="h-6 w-6 text-destructive" />
					</div>
					<CardTitle className="text-2xl">500 - Server Error</CardTitle>
					<CardDescription>
						Something went wrong on our end. Please try again later.
					</CardDescription>
				</CardHeader>

				<CardContent className="space-y-4">
					<Alert variant="destructive">
						<ServerCrash className="h-4 w-4" />
						<AlertTitle>Error Details</AlertTitle>
						<AlertDescription className="mt-2 font-mono text-xs">
							{errorMessage}
						</AlertDescription>
					</Alert>

					{errorStack && import.meta.env.DEV && (
						<Collapsible>
							<CollapsibleTrigger className="w-full rounded-lg border p-4 text-left text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
								View stack trace (development only)
							</CollapsibleTrigger>
							<CollapsibleContent>
								<pre className="mt-2 rounded-lg border p-4 overflow-x-auto text-xs text-muted-foreground bg-muted/20">
									{errorStack}
								</pre>
							</CollapsibleContent>
						</Collapsible>
					)}

					<p className="text-center text-sm text-muted-foreground">
						If this problem persists, please contact our support team.
					</p>
				</CardContent>

				<CardFooter className="flex flex-col sm:flex-row gap-2">
					{onRetry && (
						<Button
							onClick={onRetry}
							className="w-full sm:w-auto"
							variant="default"
						>
							<RefreshCw className="mr-2 h-4 w-4" />
							Try Again
						</Button>
					)}

					<Button asChild variant="outline" className="w-full sm:w-auto">
						<Link to="/">
							<Home className="mr-2 h-4 w-4" />
							Go Home
						</Link>
					</Button>

					<Button asChild variant="outline" className="w-full sm:w-auto">
						<a href="mailto:support@seal.com">
							<Mail className="mr-2 h-4 w-4" />
							Contact Support
						</a>
					</Button>
				</CardFooter>
			</Card>
		</div>
	);
}
