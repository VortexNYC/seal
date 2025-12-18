import { cn } from "@/lib/utils";

interface SealLogoProps {
	className?: string;
	size?: number;
	/** Use white variant for dark backgrounds */
	variant?: "color" | "white" | "black";
	/** Show logo with background */
	withBackground?: boolean;
}

/**
 * Seal brand logo component.
 * Uses the official Seal feather/quill logo.
 *
 * Variants:
 * - "color": Teal colored logo (default, best for light backgrounds)
 * - "white": White logo (best for dark backgrounds)
 * - "black": Black logo (best for light backgrounds with high contrast)
 */
export function SealLogo({
	className,
	size = 32,
	variant = "color",
	withBackground = false,
}: SealLogoProps) {
	const getSrc = () => {
		if (withBackground && variant === "color") {
			return "/logo/seal-logo-color-with-background.svg";
		}

		switch (variant) {
			case "white":
				return "/logo/seal-logo-white-no-background.svg";
			case "black":
				return "/logo/seal-logo-black-no-background.svg";
			default:
				return "/logo/seal-logo-color-no-background.svg";
		}
	};

	return (
		<img
			src={getSrc()}
			alt="Seal Logo"
			width={size}
			height={size}
			className={cn("object-contain", className)}
		/>
	);
}

interface SealLogoAutoProps {
	className?: string;
	size?: number;
	/** Show logo with background */
	withBackground?: boolean;
}

/**
 * Seal logo that automatically switches between color/white variants
 * based on the current theme (light/dark mode).
 */
export function SealLogoAuto({
	className,
	size = 32,
	withBackground = false,
}: SealLogoAutoProps) {
	return (
		<>
			{/* Color logo for light mode */}
			<img
				src={
					withBackground
						? "/logo/seal-logo-color-with-background.svg"
						: "/logo/seal-logo-color-no-background.svg"
				}
				alt="Seal Logo"
				width={size}
				height={size}
				className={cn("object-contain dark:hidden", className)}
			/>
			{/* White logo for dark mode */}
			<img
				src="/logo/seal-logo-white-no-background.svg"
				alt="Seal Logo"
				width={size}
				height={size}
				className={cn("object-contain hidden dark:block", className)}
			/>
		</>
	);
}

interface SealLogoBadgeProps {
	className?: string;
	/** Size of the logo inside the badge */
	size?: "sm" | "md" | "lg" | "xl" | "header";
}

const badgeSizes = {
	sm: { logo: 32, padding: "p-2" },
	md: { logo: 48, padding: "p-3" },
	lg: { logo: 80, padding: "p-4" },
	xl: { logo: 160, padding: "p-5" },
	header: { logo: 72, padding: "p-1" },
};

/**
 * Seal logo in a styled badge container with gradient background,
 * shadow, and border. Automatically switches logo variant for dark mode.
 */
export function SealLogoBadge({
	className,
	size = "header",
}: SealLogoBadgeProps) {
	const { logo, padding } = badgeSizes[size];

	return (
		<div
			className={cn(
				"inline-block rounded-2xl bg-gradient-to-br from-[#f3f1e9] to-white dark:from-slate-800 dark:to-slate-900",
				"shadow-xl shadow-[#013575]/10 border border-[#013575]/5 dark:border-slate-700",
				"transition-all duration-300 hover:shadow-2xl hover:shadow-[#013575]/15",
				padding,
				className,
			)}
		>
			<SealLogoAuto size={logo} />
		</div>
	);
}
