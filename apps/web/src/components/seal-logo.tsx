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
