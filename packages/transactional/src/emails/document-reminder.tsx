import {
	Body,
	Button,
	Container,
	Head,
	Heading,
	Hr,
	Html,
	Link,
	Preview,
	Section,
	Tailwind,
	Text,
} from "@react-email/components";

export interface DocumentReminderProps {
	recipientName: string;
	senderName: string;
	documentName: string;
	signingUrl: string;
	customMessage?: string;
	expiresAt?: number;
	reminderCount?: number;
}

export function DocumentReminder({
	recipientName = "Recipient",
	senderName = "Sender",
	documentName = "Document",
	signingUrl = "https://seal.nyc/sign/example",
	customMessage,
	expiresAt,
	reminderCount = 1,
}: DocumentReminderProps) {
	const previewText = `Reminder: "${documentName}" is waiting for your signature`;
	const expirationDate = expiresAt
		? new Date(expiresAt).toLocaleDateString("en-US", {
				weekday: "long",
				year: "numeric",
				month: "long",
				day: "numeric",
			})
		: null;

	const isUrgent =
		expiresAt && expiresAt - Date.now() < 3 * 24 * 60 * 60 * 1000; // Less than 3 days

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
								Signature Reminder
							</Text>
						</Section>

						<Hr className="border-[#e6ebf1] my-[24px]" />

						{/* Reminder badge */}
						<Section className="text-center mb-[24px]">
							<div
								style={{
									display: "inline-block",
									backgroundColor: isUrgent ? "#fef2f2" : "#fefce8",
									border: `1px solid ${isUrgent ? "#fecaca" : "#fde68a"}`,
									borderRadius: "9999px",
									padding: "8px 16px",
								}}
							>
								<Text
									className={`text-[14px] font-medium m-0 ${isUrgent ? "text-[#dc2626]" : "text-[#ca8a04]"}`}
								>
									{isUrgent
										? `⚠️ Urgent Reminder${reminderCount > 1 ? ` #${reminderCount}` : ""}`
										: `📬 Friendly Reminder${reminderCount > 1 ? ` #${reminderCount}` : ""}`}
								</Text>
							</div>
						</Section>

						{/* Main content */}
						<Section>
							<Text className="text-[#1a1a1a] text-[16px] leading-[26px] m-0 mb-[16px]">
								Hello {recipientName},
							</Text>

							<Text className="text-[#4b5563] text-[16px] leading-[26px] m-0 mb-[16px]">
								This is a reminder that{" "}
								<strong className="text-[#1a1a1a]">{senderName}</strong> is
								waiting for your signature on the following document:
							</Text>

							{/* Document card */}
							<Section
								className={`border border-solid rounded-lg p-[20px] mb-[24px] ${isUrgent ? "bg-[#fef2f2] border-[#fecaca]" : "bg-[#f9fafb] border-[#e5e7eb]"}`}
							>
								<Text className="text-[#1a1a1a] text-[18px] font-medium m-0 mb-[4px]">
									{documentName}
								</Text>
								{expirationDate && (
									<Text
										className={`text-[14px] m-0 ${isUrgent ? "text-[#dc2626] font-medium" : "text-[#ef4444]"}`}
									>
										{isUrgent ? "⏰ Expires soon: " : "Expires: "}
										{expirationDate}
									</Text>
								)}
							</Section>

							{/* Custom message */}
							{customMessage && (
								<Section className="bg-[#fefce8] border-l-4 border-solid border-[#eab308] pl-[16px] py-[12px] pr-[12px] mb-[24px]">
									<Text className="text-[#713f12] text-[14px] italic m-0">
										"{customMessage}"
									</Text>
									<Text className="text-[#a16207] text-[12px] m-0 mt-[4px]">
										— {senderName}
									</Text>
								</Section>
							)}

							{/* CTA Button */}
							<Section className="text-center my-[32px]">
								<Button
									className="bg-[#0f172a] rounded-lg text-white text-[16px] font-medium no-underline text-center px-[32px] py-[14px]"
									href={signingUrl}
								>
									Review & Sign Now
								</Button>
							</Section>

							<Text className="text-[#6b7280] text-[14px] leading-[22px] m-0 mb-[16px]">
								Or copy and paste this link into your browser:
							</Text>
							<Link
								href={signingUrl}
								className="text-[#2563eb] text-[14px] break-all"
							>
								{signingUrl}
							</Link>
						</Section>

						<Hr className="border-[#e6ebf1] my-[24px]" />

						{/* Footer */}
						<Section>
							<Text className="text-[#9ca3af] text-[12px] leading-[20px] m-0">
								This reminder was sent by Seal on behalf of {senderName}. If
								you've already signed this document, please disregard this
								email.
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

export default DocumentReminder;
