import { SignedIn, SignedOut } from "@clerk/clerk-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, FileText, Shield } from "lucide-react";
import { SealLogoBadgeFixed } from "@/components/seal-logo-fixed";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
	component: HomePage,
});

function HomePage() {
	return (
		<div className="min-h-screen flex flex-col bg-linear-to-b from-brand-50 via-white to-white dark:from-slate-950 dark:via-background dark:to-background">
			{/* Subtle grain texture overlay */}
			<div className="fixed inset-0 pointer-events-none opacity-[0.02] dark:opacity-[0.03]">
				<svg className="w-full h-full" aria-hidden="true">
					<title>Background texture</title>
					<filter id="grain">
						<feTurbulence
							type="fractalNoise"
							baseFrequency="0.8"
							numOctaves="4"
							stitchTiles="stitch"
						/>
					</filter>
					<rect width="100%" height="100%" filter="url(#grain)" />
				</svg>
			</div>

			{/* Header */}
			<header className="relative z-10 border-b border-brand-700/10 dark:border-slate-800 backdrop-blur-sm bg-white/70 dark:bg-background/70">
				<div className="container mx-auto px-6 py-4 flex items-center justify-between">
					<Link
						to="/"
						className="transition-transform duration-300 hover:scale-105"
					>
						<SealLogoBadgeFixed size={48} withText />
					</Link>
					<nav className="flex items-center gap-3">
						<SignedIn>
							<Button
								asChild
								className="bg-brand-700 hover:bg-brand-800 text-white shadow-md shadow-brand-700/20 transition-all duration-300 hover:shadow-lg hover:shadow-brand-700/30"
							>
								<Link to="/app" className="flex items-center gap-2">
									Go to App
									<ArrowRight className="w-4 h-4" />
								</Link>
							</Button>
						</SignedIn>
						<SignedOut>
							<Button
								variant="ghost"
								asChild
								className="text-brand-700 dark:text-slate-300 hover:text-brand-800 dark:hover:text-slate-200 hover:bg-brand-50 dark:hover:bg-slate-800"
							>
								<Link to="/sign-in">Sign In</Link>
							</Button>
							<Button
								asChild
								className="bg-brand-700 hover:bg-brand-800 text-white shadow-md shadow-brand-700/20 transition-all duration-300 hover:shadow-lg hover:shadow-brand-700/30"
							>
								<Link to="/sign-up">Get Started</Link>
							</Button>
						</SignedOut>
					</nav>
				</div>
			</header>

			{/* Hero Section */}
			<main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-20">
				<div className="max-w-4xl mx-auto text-center">
					{/* Animated logo */}
					<div className="mb-8 animate-[fadeIn_0.6s_ease-out]">
						<SealLogoBadgeFixed size={120} withText />
					</div>

					{/* Headline */}
					<h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-gray-900 dark:text-white mb-6 animate-[fadeIn_0.6s_ease-out_0.1s_both]">
						Document signatures
						<br />
						<span className="text-brand-700 dark:text-brand-400">
							made simple
						</span>
					</h1>

					{/* Subheadline */}
					<p className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-10 leading-relaxed animate-[fadeIn_0.6s_ease-out_0.2s_both]">
						Sign, send, and manage documents securely. A modern platform for
						digital signatures and workflow management.
					</p>

					{/* CTA Buttons */}
					<div className="flex flex-col sm:flex-row gap-4 justify-center mb-16 animate-[fadeIn_0.6s_ease-out_0.3s_both]">
						<SignedIn>
							<Button
								size="lg"
								asChild
								className="bg-brand-700 hover:bg-brand-800 text-white text-lg px-8 py-6 shadow-lg shadow-brand-700/25 transition-all duration-300 hover:shadow-xl hover:shadow-brand-700/30 hover:-translate-y-0.5"
							>
								<Link to="/app" className="flex items-center gap-2">
									Go to App
									<ArrowRight className="w-5 h-5" />
								</Link>
							</Button>
						</SignedIn>
						<SignedOut>
							<Button
								size="lg"
								asChild
								className="bg-brand-700 hover:bg-brand-800 text-white text-lg px-8 py-6 shadow-lg shadow-brand-700/25 transition-all duration-300 hover:shadow-xl hover:shadow-brand-700/30 hover:-translate-y-0.5"
							>
								<Link to="/sign-up" className="flex items-center gap-2">
									Get Started Free
									<ArrowRight className="w-5 h-5" />
								</Link>
							</Button>
							<Button
								size="lg"
								variant="outline"
								asChild
								className="text-lg px-8 py-6 border-2 border-brand-700/20 dark:border-slate-700 text-brand-700 dark:text-slate-300 hover:bg-brand-50 dark:hover:bg-slate-800 hover:border-brand-700/40 dark:hover:border-slate-600 transition-all duration-300"
							>
								<Link to="/sign-in">Sign In</Link>
							</Button>
						</SignedOut>
					</div>

					{/* Trust indicators */}
					<div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto animate-[fadeIn_0.6s_ease-out_0.4s_both]">
						<div className="flex items-center justify-center gap-3 text-gray-600 dark:text-gray-400">
							<div className="p-2 rounded-lg bg-brand-50 dark:bg-slate-800">
								<Shield className="w-5 h-5 text-brand-700 dark:text-brand-400" />
							</div>
							<span className="text-sm font-medium">Bank-level security</span>
						</div>
						<div className="flex items-center justify-center gap-3 text-gray-600 dark:text-gray-400">
							<div className="p-2 rounded-lg bg-brand-50 dark:bg-slate-800">
								<FileText className="w-5 h-5 text-brand-700 dark:text-brand-400" />
							</div>
							<span className="text-sm font-medium">Legally binding</span>
						</div>
						<div className="flex items-center justify-center gap-3 text-gray-600 dark:text-gray-400">
							<div className="p-2 rounded-lg bg-brand-50 dark:bg-slate-800">
								<CheckCircle2 className="w-5 h-5 text-brand-700 dark:text-brand-400" />
							</div>
							<span className="text-sm font-medium">Easy to use</span>
						</div>
					</div>
				</div>
			</main>

			{/* Footer */}
			<footer className="relative z-10 border-t border-brand-700/10 dark:border-slate-800 py-8 bg-white/50 dark:bg-background/50 backdrop-blur-sm">
				<div className="container mx-auto px-6 text-center text-sm text-gray-500 dark:text-gray-400">
					&copy; {new Date().getFullYear()} Seal. All rights reserved.
				</div>
			</footer>
		</div>
	);
}
