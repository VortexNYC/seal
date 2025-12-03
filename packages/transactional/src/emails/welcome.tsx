import {
	Body,
	Button,
	Container,
	Head,
	Heading,
	Hr,
	Html,
	Preview,
	Section,
	Tailwind,
	Text,
} from "@react-email/components";

export interface WelcomeProps {
	userName: string;
	userEmail: string;
	dashboardUrl?: string;
}

export function Welcome({
	userName = "there",
	userEmail = "user@example.com",
	dashboardUrl = "https://seal.nyc/dashboard",
}: WelcomeProps) {
	const previewText =
		"Welcome to Seal - Your document signing journey starts here";

	return (
		<Html>
			<Head />
			<Preview>{previewText}</Preview>
			<Tailwind>
				<Body className="bg-[#f6f9fc] my-auto mx-auto font-sans py-[40px]">
					<Container className="bg-white border border-solid border-[#e6ebf1] rounded-lg my-[40px] mx-auto p-[40px] w-[520px]">
						{/* Header */}
						<Section className="text-center">
							<Heading className="text-[#1a1a1a] text-[28px] font-semibold m-0 mb-[8px]">
								Seal
							</Heading>
							<Text className="text-[#6b7280] text-[14px] m-0">
								Welcome to Seal
							</Text>
						</Section>

						<Hr className="border-[#e6ebf1] my-[24px]" />

						{/* Welcome banner */}
						<Section className="text-center mb-[24px]">
							<div
								style={{
									width: "80px",
									height: "80px",
									backgroundColor: "#f0fdf4",
									borderRadius: "50%",
									display: "inline-flex",
									alignItems: "center",
									justifyContent: "center",
								}}
							>
								<Text
									className="text-[40px] m-0"
									style={{ lineHeight: "80px" }}
								>
									👋
								</Text>
							</div>
						</Section>

						{/* Main content */}
						<Section>
							<Heading className="text-[#1a1a1a] text-[22px] font-semibold m-0 mb-[16px] text-center">
								Welcome to Seal, {userName}!
							</Heading>

							<Text className="text-[#4b5563] text-[16px] leading-[26px] m-0 mb-[24px] text-center">
								Your account has been created successfully. You're now ready to
								start sending documents for signature.
							</Text>

							{/* Features list */}
							<Section className="bg-[#f9fafb] border border-solid border-[#e5e7eb] rounded-lg p-[24px] mb-[24px]">
								<Text className="text-[#1a1a1a] text-[16px] font-medium m-0 mb-[16px]">
									Here's what you can do with Seal:
								</Text>

								<Text className="text-[#4b5563] text-[14px] leading-[24px] m-0 mb-[8px]">
									✓ Upload and prepare documents for signing
								</Text>
								<Text className="text-[#4b5563] text-[14px] leading-[24px] m-0 mb-[8px]">
									✓ Add signature fields and assign recipients
								</Text>
								<Text className="text-[#4b5563] text-[14px] leading-[24px] m-0 mb-[8px]">
									✓ Track document status in real-time
								</Text>
								<Text className="text-[#4b5563] text-[14px] leading-[24px] m-0">
									✓ Get notified when documents are signed
								</Text>
							</Section>

							{/* CTA Button */}
							<Section className="text-center my-[32px]">
								<Button
									className="bg-[#0f172a] rounded-lg text-white text-[16px] font-medium no-underline text-center px-[32px] py-[14px]"
									href={dashboardUrl}
								>
									Go to Dashboard
								</Button>
							</Section>

							<Text className="text-[#6b7280] text-[14px] leading-[22px] m-0 text-center">
								If you have any questions, feel free to reply to this email.
								We're here to help!
							</Text>
						</Section>

						<Hr className="border-[#e6ebf1] my-[24px]" />

						{/* Footer */}
						<Section>
							<Text className="text-[#9ca3af] text-[12px] leading-[20px] m-0">
								This email was sent to {userEmail} because you created an
								account on Seal. If you didn't create this account, please
								ignore this email.
							</Text>
							<Text className="text-[#9ca3af] text-[12px] leading-[20px] m-0 mt-[12px]">
								© {new Date().getFullYear()} Seal. All rights reserved.
							</Text>
						</Section>
					</Container>
				</Body>
			</Tailwind>
		</Html>
	);
}

export default Welcome;
