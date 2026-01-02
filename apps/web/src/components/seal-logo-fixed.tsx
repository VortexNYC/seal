"use client";

import { cn } from "@/lib/utils";

interface SealLogoBadgeFixedProps {
	className?: string;
	/** The total size of the badge in pixels */
	size?: number;
	/** Whether to show the text logo or just the icon */
	withText?: boolean;
}

/**
 * A proportionally scaling Seal logo badge.
 * All internal elements (padding, border-radius, logo) scale based on the `size` prop.
 */
export function SealLogoBadgeFixed({
	className,
	size = 80,
	withText = false,
}: SealLogoBadgeFixedProps) {
	// Proportions
	const paddingRatio = withText ? 0.08 : 0.15;
	const borderRadiusRatio = 0.2;

	const padding = size * paddingRatio;
	const borderRadius = size * borderRadiusRatio;

	return (
		<div
			className={cn(
				"inline-flex items-center justify-center bg-linear-to-br from-[#f0f7ff] to-white dark:from-slate-800 dark:to-slate-900",
				"shadow-xl shadow-brand-700/10 border border-brand-700/5 dark:border-slate-700",
				"transition-all duration-300 hover:shadow-2xl hover:shadow-brand-700/15",
				className,
			)}
			style={{
				width: withText ? "auto" : size,
				height: size,
				padding: padding,
				borderRadius: borderRadius,
				minWidth: withText ? size * 2 : size,
			}}
		>
			{withText ? (
				<>
					<img
						src="/logo/seal-logo-color-no-background.svg"
						alt="Seal Logo"
						className="h-full w-auto object-contain dark:hidden"
					/>
					<img
						src="/logo/seal-logo-white-no-background.svg"
						alt="Seal Logo"
						className="h-full w-auto object-contain hidden dark:block"
					/>
				</>
			) : (
				<>
					<img
						src="/logo/seal-icon-color-no-background.svg"
						alt="Seal Icon"
						className="h-full w-full object-contain dark:hidden"
					/>
					<img
						src="/logo/seal-icon-white-no-background.svg"
						alt="Seal Icon"
						className="h-full w-full object-contain hidden dark:block"
					/>
				</>
			)}
		</div>
	);
}
