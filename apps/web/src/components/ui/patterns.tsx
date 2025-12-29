import { cn } from "@/lib/utils";

interface StripeColumnProps {
	className?: string;
	position?: "left" | "right";
}

export function StripeColumn({
	className,
	position = "left",
}: StripeColumnProps) {
	return (
		<div
			className={cn(
				"hidden md:block w-10 border-x border-brand-900/5 dark:border-white/5",
				"bg-[size:10px_10px] bg-fixed",
				position === "left" ? "col-start-1" : "col-start-3",
				"row-span-full row-start-1",
				className,
			)}
			style={{
				backgroundImage:
					"repeating-linear-gradient(315deg, rgb(0 0 0 / 0.03) 0px, rgb(0 0 0 / 0.03) 1px, transparent 0px, transparent 50%)",
			}}
		/>
	);
}

interface GridLayoutProps {
	children: React.ReactNode;
	className?: string;
	showStripes?: boolean;
}

export function GridLayout({
	children,
	className,
	showStripes = true,
}: GridLayoutProps) {
	return (
		<div
			className={cn(
				"grid min-h-screen",
				showStripes
					? "md:grid-cols-[40px_1fr_40px] grid-cols-1"
					: "grid-cols-1",
				className,
			)}
		>
			{showStripes && <StripeColumn position="left" />}
			<div className={cn(showStripes && "col-start-2")}>{children}</div>
			{showStripes && <StripeColumn position="right" />}
		</div>
	);
}

interface DotPatternProps {
	className?: string;
}

export function DotPattern({ className }: DotPatternProps) {
	return (
		<div
			className={cn("pointer-events-none", "bg-[size:16px_16px]", className)}
			style={{
				backgroundImage:
					"radial-gradient(circle, rgb(0 0 0 / 0.35) 1px, transparent 1px)",
			}}
		/>
	);
}

interface CardWithDotsProps {
	children: React.ReactNode;
	className?: string;
}

export function CardWithDots({ children, className }: CardWithDotsProps) {
	return (
		<div
			className={cn(
				"relative overflow-hidden rounded-lg",
				"bg-brand-950/[2.5%] dark:bg-white/[2.5%]",
				"ring-1 ring-inset ring-brand-950/5 dark:ring-white/5",
				className,
			)}
		>
			<DotPattern />
			{children}
		</div>
	);
}
