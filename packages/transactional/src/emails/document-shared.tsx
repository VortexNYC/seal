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

export interface DocumentSharedProps {
	recipientEmail: string;
	recipientName: string;
	sharerName: string;
	sharerEmail: string;
	documentName: string;
	permissionLevel: "view" | "edit" | "manage";
	documentUrl: string;
}

const permissionDescriptions = {
	view: "You can view this document",
	edit: "You can view and edit this document",
	manage: "You have full access to manage this document",
};

const permissionLabels = {
	view: "View",
	edit: "Edit",
	manage: "Manage",
};

export function DocumentShared({
	recipientEmail = "recipient@example.com",
	recipientName = "John",
	sharerName = "Jane Doe",
	sharerEmail = "jane@example.com",
	documentName = "Employment Agreement",
	permissionLevel = "view",
	documentUrl = "https://seal.nyc/documents/abc123",
}: DocumentSharedProps) {
	const previewText = `${sharerName} shared "${documentName}" with you on Seal`;

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
								Document Shared
							</Text>
						</Section>

						<Hr className="border-[#e6ebf1] my-[24px]" />

						{/* Sharing icon */}
						<Section className="text-center mb-[24px]">
							<div
								style={{
									width: "64px",
									height: "64px",
									backgroundColor: "#eff6ff",
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
									📄
								</Text>
							</div>
						</Section>

						{/* Main content */}
						<Section>
							<Heading className="text-[#1a1a1a] text-[22px] font-semibold m-0 mb-[16px] text-center">
								A document was shared with you
							</Heading>

							<Text className="text-[#4b5563] text-[16px] leading-[26px] m-0 mb-[24px] text-center">
								Hi {recipientName},
							</Text>

							<Text className="text-[#4b5563] text-[16px] leading-[26px] m-0 mb-[24px] text-center">
								<strong className="text-[#1a1a1a]">{sharerName}</strong> (
								<Link
									href={`mailto:${sharerEmail}`}
									className="text-[#2563eb] no-underline"
								>
									{sharerEmail}
								</Link>
								) has shared a document with you on Seal.
							</Text>

							{/* Document card */}
							<Section className="bg-[#f9fafb] border border-solid border-[#e5e7eb] rounded-lg p-[20px] mb-[24px]">
								<Text className="text-[#1a1a1a] text-[18px] font-medium m-0 mb-[8px]">
									{documentName}
								</Text>
								<Text className="text-[#6b7280] text-[14px] m-0 mb-[4px]">
									Your access level:{" "}
									<strong className="text-[#1a1a1a]">
										{permissionLabels[permissionLevel]}
									</strong>
								</Text>
								<Text className="text-[#4b5563] text-[14px] m-0">
									{permissionDescriptions[permissionLevel]}
								</Text>
							</Section>

							{/* CTA Button */}
							<Section className="text-center my-[32px]">
								<Button
									className="bg-[#0f172a] rounded-lg text-white text-[16px] font-medium no-underline text-center px-[32px] py-[14px]"
									href={documentUrl}
								>
									View Document
								</Button>
							</Section>

							<Text className="text-[#6b7280] text-[14px] leading-[22px] m-0 mb-[16px]">
								Or copy and paste this link into your browser:
							</Text>
							<Link
								href={documentUrl}
								className="text-[#2563eb] text-[14px] break-all"
							>
								{documentUrl}
							</Link>
						</Section>

						<Hr className="border-[#e6ebf1] my-[24px]" />

						{/* Footer */}
						<Section>
							<Text className="text-[#9ca3af] text-[12px] leading-[20px] m-0">
								This email was sent to {recipientEmail} because a document was
								shared with you. If you believe this was sent in error, you can
								safely ignore this email.
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

export default DocumentShared;
