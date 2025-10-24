import { SignedIn, SignedOut } from "@clerk/clerk-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
	component: HomePage,
});

function HomePage() {
	return (
		<div className="min-h-screen flex flex-col">
			{/* Header */}
			<header className="border-b">
				<div className="container mx-auto px-4 py-4 flex items-center justify-between">
					<Link to="/">
						<h1 className="text-2xl font-bold">Seal</h1>
					</Link>
					<nav className="flex items-center gap-4">
						<SignedIn>
							<Button asChild>
								<Link to="/app">Go to App</Link>
							</Button>
						</SignedIn>
						<SignedOut>
							<Button variant="ghost" asChild>
								<Link to="/sign-in">Sign In</Link>
							</Button>
							<Button asChild>
								<Link to="/sign-up">Get Started</Link>
							</Button>
						</SignedOut>
					</nav>
				</div>
			</header>

			{/* Hero Section */}
			<main className="flex-1 flex flex-col items-center justify-center px-4">
				<div className="max-w-4xl mx-auto text-center space-y-8">
					<h2 className="text-5xl md:text-6xl font-bold tracking-tight">
						Welcome to Seal
					</h2>
					<p className="text-xl text-muted-foreground max-w-2xl mx-auto">
						A modern platform for team collaboration and workspace management.
					</p>
					<div className="flex gap-4 justify-center">
						<SignedIn>
							<Button size="lg" asChild>
								<Link to="/app">Go to App</Link>
							</Button>
						</SignedIn>
						<SignedOut>
							<Button size="lg" asChild>
								<Link to="/sign-up">Get Started</Link>
							</Button>
							<Button size="lg" variant="outline" asChild>
								<Link to="/sign-in">Sign In</Link>
							</Button>
						</SignedOut>
					</div>
				</div>
			</main>

			{/* Footer */}
			<footer className="border-t py-6">
				<div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
					&copy; {new Date().getFullYear()} Seal. All rights reserved.
				</div>
			</footer>
		</div>
	);
}
