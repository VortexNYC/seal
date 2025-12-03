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

interface RecipientSummary {
	name: string;
	email: string;
	role: "signer" | "approver" | "viewer";
	completedAt: number;
}

export interface DocumentCompletedProps {
	senderName: string;
	documentName: string;
	documentUrl: string;
	completedAt: number;
	recipientsSummary: RecipientSummary[];
}

export function DocumentCompleted({
	senderName = "User",
	documentName = "Document",
	documentUrl = "https://seal.nyc/documents/example",
	completedAt = Date.now(),
	recipientsSummary = [],
}: DocumentCompletedProps) {
	const previewText = `All signatures collected for "${documentName}"`;

	const formattedDate = new Date(completedAt).toLocaleDateString("en-US", {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});

	const getRoleLabel = (role: RecipientSummary["role"]) => {
		switch (role) {
			case "signer":
				return "Signed";
			case "approver":
				return "Approved";
			case "viewer":
				return "Viewed";
		}
	};

	const formatRecipientDate = (timestamp: number) => {
		return new Date(timestamp).toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

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
								Document Complete
							</Text>
						</Section>

						<Hr className="border-[#e6ebf1] my-[24px]" />

						{/* Success banner */}
						<Section className="bg-[#f0fdf4] border border-solid border-[#bbf7d0] rounded-lg p-[20px] mb-[24px] text-center">
							<Text className="text-[32px] m-0 mb-[8px]">✓</Text>
							<Text className="text-[#166534] text-[18px] font-semibold m-0">
								All Signatures Collected
							</Text>
						</Section>

						{/* Main content */}
						<Section>
							<Text className="text-[#1a1a1a] text-[16px] leading-[26px] m-0 mb-[16px]">
								Hello {senderName},
							</Text>

							<Text className="text-[#4b5563] text-[16px] leading-[26px] m-0 mb-[24px]">
								Great news! All recipients have completed their actions on your
								document. Here's the summary:
							</Text>

							{/* Document card */}
							<Section className="bg-[#f9fafb] border border-solid border-[#e5e7eb] rounded-lg p-[20px] mb-[24px]">
								<Text className="text-[#1a1a1a] text-[18px] font-medium m-0 mb-[4px]">
									{documentName}
								</Text>
								<Text className="text-[#6b7280] text-[14px] m-0">
									Completed on: {formattedDate}
								</Text>
							</Section>

							{/* Recipients summary */}
							{recipientsSummary.length > 0 && (
								<Section className="mb-[24px]">
									<Text className="text-[#1a1a1a] text-[14px] font-semibold m-0 mb-[12px]">
										Recipient Activity:
									</Text>
									{recipientsSummary.map((recipient, index) => (
										<Section
											key={recipient.email}
											className={`py-[12px] ${index < recipientsSummary.length - 1 ? "border-b border-solid border-[#e5e7eb]" : ""}`}
										>
											<Text className="text-[#1a1a1a] text-[14px] font-medium m-0">
												{recipient.name}
											</Text>
											<Text className="text-[#6b7280] text-[12px] m-0 mt-[2px]">
												{recipient.email}
											</Text>
											<Text className="text-[#059669] text-[12px] m-0 mt-[4px]">
												{getRoleLabel(recipient.role)} •{" "}
												{formatRecipientDate(recipient.completedAt)}
											</Text>
										</Section>
									))}
								</Section>
							)}

							{/* CTA Button */}
							<Section className="text-center my-[32px]">
								<Button
									className="bg-[#0f172a] rounded-lg text-white text-[16px] font-medium no-underline text-center px-[32px] py-[14px]"
									href={documentUrl}
								>
									View Completed Document
								</Button>
							</Section>

							<Text className="text-[#4b5563] text-[14px] leading-[22px] m-0">
								The signed document is now available in your Seal dashboard. You
								can download it at any time.
							</Text>
						</Section>

						<Hr className="border-[#e6ebf1] my-[24px]" />

						{/* Footer */}
						<Section>
							<Text className="text-[#9ca3af] text-[12px] leading-[20px] m-0">
								This notification was sent by Seal. Please keep this email for
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

export default DocumentCompleted;
