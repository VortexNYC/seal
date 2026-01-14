import { SignedIn, SignedOut } from "@clerk/clerk-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, FileText, Shield } from "lucide-react";
import { SealLogoBadgeFixed } from "@/components/seal-logo-fixed";
import { LandingPageJsonLd } from "@/components/seo";
import { BackgroundPattern } from "@/components/ui/background-pattern";
import { Button } from "@/components/ui/button";
import { GridLayout } from "@/components/ui/patterns";
import { useAnalytics } from "@/hooks/use-analytics";
import { getCanonicalUrl, pageSEO } from "@/lib/seo";

export const Route = createFileRoute("/")({
	component: HomePage,
	head: () => ({
		meta: [
			{ title: pageSEO.home.title },
			{ name: "description", content: pageSEO.home.description },
			{ property: "og:title", content: pageSEO.home.title },
			{ property: "og:description", content: pageSEO.home.description },
			{ property: "og:type", content: "website" },
		],
		links: [{ rel: "canonical", href: getCanonicalUrl("/") }],
	}),
});

function HomePage() {
	const { capture } = useAnalytics();

	return (
		<GridLayout className="bg-linear-to-b from-brand-50 via-white to-white dark:from-slate-950 dark:via-background dark:to-background">
			<LandingPageJsonLd />
			<BackgroundPattern className="bg-transparent" opacity={0.04} />

			<div className="flex flex-col min-h-screen">
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
									onClick={() =>
										capture("cta_clicked", {
											button: "go_to_app",
											location: "header",
										})
									}
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
									onClick={() =>
										capture("cta_clicked", {
											button: "sign_in",
											location: "header",
										})
									}
								>
									<Link to="/sign-in">Sign In</Link>
								</Button>
								<Button
									asChild
									className="bg-brand-700 hover:bg-brand-800 text-white shadow-md shadow-brand-700/20 transition-all duration-300 hover:shadow-lg hover:shadow-brand-700/30"
									onClick={() =>
										capture("cta_clicked", {
											button: "get_started",
											location: "header",
										})
									}
								>
									<Link to="/sign-up">Get Started</Link>
								</Button>
							</SignedOut>
						</nav>
					</div>
				</header>

				<main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-20">
					<article className="max-w-4xl mx-auto text-center">
						<div
							className="mb-8 animate-[fadeIn_0.6s_ease-out]"
							aria-hidden="true"
						>
							<SealLogoBadgeFixed size={120} withText />
						</div>

						<h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-gray-900 dark:text-white mb-6 animate-[fadeIn_0.6s_ease-out_0.1s_both]">
							Document signatures
							<br />
							<span className="text-brand-700 dark:text-brand-400">
								made simple
							</span>
						</h1>

						<p className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-10 leading-relaxed animate-[fadeIn_0.6s_ease-out_0.2s_both]">
							Sign, send, and manage documents securely. A modern platform for
							digital signatures and workflow management.
						</p>

						<div className="flex flex-col sm:flex-row gap-4 justify-center mb-16 animate-[fadeIn_0.6s_ease-out_0.3s_both]">
							<SignedIn>
								<Button
									size="lg"
									asChild
									className="bg-brand-700 hover:bg-brand-800 text-white text-lg px-8 py-6 shadow-lg shadow-brand-700/25 transition-all duration-300 hover:shadow-xl hover:shadow-brand-700/30 hover:-translate-y-0.5"
									onClick={() =>
										capture("cta_clicked", {
											button: "go_to_app",
											location: "hero",
										})
									}
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
									onClick={() =>
										capture("cta_clicked", {
											button: "get_started_free",
											location: "hero",
										})
									}
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
									onClick={() =>
										capture("cta_clicked", {
											button: "sign_in",
											location: "hero",
										})
									}
								>
									<Link to="/sign-in">Sign In</Link>
								</Button>
							</SignedOut>
						</div>

						<section
							aria-label="Key features"
							className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto animate-[fadeIn_0.6s_ease-out_0.4s_both]"
						>
							<article className="flex items-center justify-center gap-3 text-gray-600 dark:text-gray-400">
								<div
									className="p-2 rounded-lg bg-brand-50 dark:bg-slate-800"
									aria-hidden="true"
								>
									<Shield className="w-5 h-5 text-brand-700 dark:text-brand-400" />
								</div>
								<h2 className="text-sm font-medium">Bank-level security</h2>
							</article>
							<article className="flex items-center justify-center gap-3 text-gray-600 dark:text-gray-400">
								<div
									className="p-2 rounded-lg bg-brand-50 dark:bg-slate-800"
									aria-hidden="true"
								>
									<FileText className="w-5 h-5 text-brand-700 dark:text-brand-400" />
								</div>
								<h2 className="text-sm font-medium">Legally binding</h2>
							</article>
							<article className="flex items-center justify-center gap-3 text-gray-600 dark:text-gray-400">
								<div
									className="p-2 rounded-lg bg-brand-50 dark:bg-slate-800"
									aria-hidden="true"
								>
									<CheckCircle2 className="w-5 h-5 text-brand-700 dark:text-brand-400" />
								</div>
								<h2 className="text-sm font-medium">Easy to use</h2>
							</article>
						</section>
					</article>
				</main>

				<footer className="relative z-10 border-t border-brand-700/10 dark:border-slate-800 py-8 bg-white/50 dark:bg-background/50 backdrop-blur-sm">
					<div className="container mx-auto px-6 text-center text-sm text-gray-500 dark:text-gray-400">
						&copy; {new Date().getFullYear()} Seal. All rights reserved.
					</div>
				</footer>
			</div>
		</GridLayout>
	);
}
