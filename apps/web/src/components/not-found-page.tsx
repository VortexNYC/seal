import { Link } from "@tanstack/react-router";
import {
	ArrowLeftIcon,
	FileSearchIcon,
	HomeIcon,
	MailIcon,
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
 * 404 Not Found page component
 *
 * Displays when a user navigates to a route that doesn't exist.
 * Includes helpful navigation links to get users back on track.
 */
export function NotFoundPage() {
	return (
		<div className="flex min-h-svh items-center justify-center bg-background p-4">
			<Card className="w-full max-w-lg">
				<CardHeader className="text-center">
					<div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-muted">
						<FileSearchIcon className="size-8 text-muted-foreground" />
					</div>
					<CardTitle className="text-2xl">Page not found</CardTitle>
					<CardDescription className="text-base">
						Sorry, we couldn't find the page you're looking for. It may have
						been moved, deleted, or never existed.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="space-y-2">
						<p className="text-sm font-medium text-muted-foreground">
							Here are some helpful links:
						</p>
						<ul className="space-y-1 text-sm text-muted-foreground">
							<li className="flex items-center gap-2">
								<span className="size-1.5 rounded-full bg-muted-foreground" />
								<Link to="/" className="hover:text-foreground hover:underline">
									Go to the home page
								</Link>
							</li>
							<li className="flex items-center gap-2">
								<span className="size-1.5 rounded-full bg-muted-foreground" />
								<Link
									to="/app"
									className="hover:text-foreground hover:underline"
								>
									View your dashboard
								</Link>
							</li>
							<li className="flex items-center gap-2">
								<span className="size-1.5 rounded-full bg-muted-foreground" />
								<a
									href="mailto:support@seal.nyc"
									className="hover:text-foreground hover:underline"
								>
									Contact support
								</a>
							</li>
						</ul>
					</div>
				</CardContent>
				<CardFooter className="flex flex-col gap-3 sm:flex-row">
					<Button asChild variant="default" className="w-full sm:w-auto">
						<Link to="/">
							<HomeIcon className="size-4" />
							Go to Home
						</Link>
					</Button>
					<Button
						variant="outline"
						className="w-full sm:w-auto"
						onClick={() => window.history.back()}
					>
						<ArrowLeftIcon className="size-4" />
						Go Back
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
