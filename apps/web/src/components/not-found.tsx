import { Link } from "@tanstack/react-router";
import { FileQuestion, Home, Undo2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export function NotFound({ children }: { children?: ReactNode }) {
	return (
		<div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8">
			<Card className="w-full max-w-2xl">
				<CardHeader className="text-center">
					<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
						<FileQuestion className="h-6 w-6 text-muted-foreground" />
					</div>
					<CardTitle className="text-2xl">404 - Page Not Found</CardTitle>
					<CardDescription>
						{children || "The page you are looking for does not exist."}
					</CardDescription>
				</CardHeader>

				<CardContent>
					<p className="text-center text-sm text-muted-foreground">
						The page may have been moved, deleted, or the URL might be
						incorrect.
					</p>
				</CardContent>

				<CardFooter className="flex flex-col sm:flex-row gap-2">
					<Button
						onClick={() => window.history.back()}
						variant="default"
						className="w-full sm:w-auto"
					>
						<Undo2 className="mr-2 h-4 w-4" />
						Go Back
					</Button>
					<Button asChild variant="outline" className="w-full sm:w-auto">
						<Link to="/">
							<Home className="mr-2 h-4 w-4" />
							Go Home
						</Link>
					</Button>
				</CardFooter>
			</Card>
		</div>
	);
}
