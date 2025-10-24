interface SealLogoProps {
	className?: string;
	size?: number;
}

export function SealLogo({ className, size = 32 }: SealLogoProps) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 100 100"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			className={className}
			role="img"
			aria-label="Seal Logo"
		>
			<title>Seal Logo</title>
			{/* Main body - elongated seal shape */}
			<ellipse
				cx="50"
				cy="50"
				rx="38"
				ry="25"
				fill="currentColor"
				opacity="0.9"
			/>

			{/* Head bump */}
			<ellipse cx="30" cy="40" rx="18" ry="20" fill="currentColor" />

			{/* Snout */}
			<ellipse
				cx="18"
				cy="38"
				rx="8"
				ry="10"
				fill="currentColor"
				opacity="0.95"
			/>

			{/* Eyes */}
			<circle cx="28" cy="35" r="3" fill="white" />
			<circle cx="28" cy="35" r="1.5" fill="#222" />

			{/* Nose */}
			<ellipse cx="15" cy="38" rx="2.5" ry="2" fill="#222" />

			{/* Whisker spots */}
			<circle cx="20" cy="42" r="1" fill="#222" opacity="0.3" />
			<circle cx="20" cy="45" r="1" fill="#222" opacity="0.3" />

			{/* Front flipper */}
			<ellipse
				cx="38"
				cy="58"
				rx="8"
				ry="14"
				fill="currentColor"
				opacity="0.85"
				transform="rotate(-30 38 58)"
			/>

			{/* Back flipper */}
			<path
				d="M 75 48 Q 82 45 88 48 Q 85 52 82 54 Q 78 52 75 48 Z"
				fill="currentColor"
				opacity="0.85"
			/>
			<path
				d="M 75 52 Q 82 50 88 54 Q 85 57 82 58 Q 78 55 75 52 Z"
				fill="currentColor"
				opacity="0.85"
			/>

			{/* Belly highlight */}
			<ellipse cx="50" cy="55" rx="25" ry="15" fill="white" opacity="0.15" />
		</svg>
	);
}
