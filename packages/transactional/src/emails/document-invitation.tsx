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

export interface DocumentInvitationProps {
	recipientName: string;
	senderName: string;
	documentName: string;
	signingUrl: string;
	customMessage?: string;
	expiresAt?: number;
}

export function DocumentInvitation({
	recipientName = "Recipient",
	senderName = "Sender",
	documentName = "Document",
	signingUrl = "https://seal.nyc/sign/example",
	customMessage,
	expiresAt,
}: DocumentInvitationProps) {
	const previewText = `${senderName} sent you "${documentName}" to sign`;
	const expirationDate = expiresAt
		? new Date(expiresAt).toLocaleDateString("en-US", {
				weekday: "long",
				year: "numeric",
				month: "long",
				day: "numeric",
			})
		: null;

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
								Document Signature Request
							</Text>
						</Section>

						<Hr className="border-[#e6ebf1] my-[24px]" />

						{/* Main content */}
						<Section>
							<Text className="text-[#1a1a1a] text-[16px] leading-[26px] m-0 mb-[16px]">
								Hello {recipientName},
							</Text>

							<Text className="text-[#4b5563] text-[16px] leading-[26px] m-0 mb-[16px]">
								<strong className="text-[#1a1a1a]">{senderName}</strong> has
								sent you a document to sign:
							</Text>

							{/* Document card */}
							<Section className="bg-[#f9fafb] border border-solid border-[#e5e7eb] rounded-lg p-[20px] mb-[24px]">
								<Text className="text-[#1a1a1a] text-[18px] font-medium m-0 mb-[4px]">
									{documentName}
								</Text>
								{expirationDate && (
									<Text className="text-[#ef4444] text-[14px] m-0">
										Expires: {expirationDate}
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
									Review & Sign Document
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
								This email was sent by Seal on behalf of {senderName}. If you
								didn't expect this email, you can safely ignore it.
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

export default DocumentInvitation;
