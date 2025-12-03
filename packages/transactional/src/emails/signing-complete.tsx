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

export interface SigningCompleteProps {
	recipientName: string;
	documentName: string;
	signedAt: number;
	role: "signer" | "approver" | "viewer";
	downloadUrl?: string;
}

export function SigningComplete({
	recipientName = "Recipient",
	documentName = "Document",
	signedAt = Date.now(),
	role = "signer",
	downloadUrl,
}: SigningCompleteProps) {
	const actionText =
		role === "signer" ? "signed" : role === "approver" ? "approved" : "viewed";
	const actionPastTense =
		role === "signer"
			? "signature"
			: role === "approver"
				? "approval"
				: "review";
	const previewText = `You have successfully ${actionText} "${documentName}"`;

	const formattedDate = new Date(signedAt).toLocaleDateString("en-US", {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});

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
								{actionPastTense.charAt(0).toUpperCase() +
									actionPastTense.slice(1)}{" "}
								Confirmation
							</Text>
						</Section>

						<Hr className="border-[#e6ebf1] my-[24px]" />

						{/* Success icon */}
						<Section className="text-center mb-[24px]">
							<div
								style={{
									width: "64px",
									height: "64px",
									backgroundColor: "#dcfce7",
									borderRadius: "50%",
									display: "inline-flex",
									alignItems: "center",
									justifyContent: "center",
								}}
							>
								<Text
									className="text-[32px] m-0"
									style={{ lineHeight: "64px" }}
								>
									✓
								</Text>
							</div>
						</Section>

						{/* Main content */}
						<Section>
							<Text className="text-[#1a1a1a] text-[16px] leading-[26px] m-0 mb-[16px]">
								Hello {recipientName},
							</Text>

							<Text className="text-[#4b5563] text-[16px] leading-[26px] m-0 mb-[24px]">
								You have successfully <strong>{actionText}</strong> the
								following document:
							</Text>

							{/* Document card */}
							<Section className="bg-[#f0fdf4] border border-solid border-[#bbf7d0] rounded-lg p-[20px] mb-[24px]">
								<Text className="text-[#166534] text-[18px] font-medium m-0 mb-[8px]">
									{documentName}
								</Text>
								<Text className="text-[#15803d] text-[14px] m-0">
									{actionPastTense.charAt(0).toUpperCase() +
										actionPastTense.slice(1)}{" "}
									on: {formattedDate}
								</Text>
							</Section>

							<Text className="text-[#4b5563] text-[16px] leading-[26px] m-0 mb-[16px]">
								A copy of this document has been saved for your records. You
								will receive another email when all parties have completed
								signing.
							</Text>

							{/* Download button if available */}
							{downloadUrl && (
								<Section className="text-center my-[32px]">
									<Button
										className="bg-[#0f172a] rounded-lg text-white text-[16px] font-medium no-underline text-center px-[32px] py-[14px]"
										href={downloadUrl}
									>
										Download Document
									</Button>
								</Section>
							)}
						</Section>

						<Hr className="border-[#e6ebf1] my-[24px]" />

						{/* Footer */}
						<Section>
							<Text className="text-[#9ca3af] text-[12px] leading-[20px] m-0">
								This confirmation was sent by Seal. Please keep this email for
								your records.
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

export default SigningComplete;
