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

export interface TeamInvitationProps {
	inviteeEmail: string;
	inviterName: string;
	inviterEmail: string;
	organizationName: string;
	role: string;
	inviteUrl: string;
	expiresAt?: number;
}

export function TeamInvitation({
	inviteeEmail = "invitee@example.com",
	inviterName = "John Doe",
	inviterEmail = "john@example.com",
	organizationName = "Acme Inc",
	role = "Member",
	inviteUrl = "https://seal.nyc/invite/abc123",
	expiresAt,
}: TeamInvitationProps) {
	const previewText = `${inviterName} invited you to join ${organizationName} on Seal`;
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
								Team Invitation
							</Text>
						</Section>

						<Hr className="border-[#e6ebf1] my-[24px]" />

						{/* Invitation icon */}
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
									✉️
								</Text>
							</div>
						</Section>

						{/* Main content */}
						<Section>
							<Heading className="text-[#1a1a1a] text-[22px] font-semibold m-0 mb-[16px] text-center">
								You've been invited!
							</Heading>

							<Text className="text-[#4b5563] text-[16px] leading-[26px] m-0 mb-[24px] text-center">
								<strong className="text-[#1a1a1a]">{inviterName}</strong> (
								<Link
									href={`mailto:${inviterEmail}`}
									className="text-[#2563eb] no-underline"
								>
									{inviterEmail}
								</Link>
								) has invited you to join{" "}
								<strong className="text-[#1a1a1a]">{organizationName}</strong>{" "}
								on Seal.
							</Text>

							{/* Organization card */}
							<Section className="bg-[#f9fafb] border border-solid border-[#e5e7eb] rounded-lg p-[20px] mb-[24px]">
								<Text className="text-[#1a1a1a] text-[18px] font-medium m-0 mb-[8px]">
									{organizationName}
								</Text>
								<Text className="text-[#6b7280] text-[14px] m-0 mb-[4px]">
									Your role: <strong className="text-[#1a1a1a]">{role}</strong>
								</Text>
								{expirationDate && (
									<Text className="text-[#ef4444] text-[14px] m-0">
										Invitation expires: {expirationDate}
									</Text>
								)}
							</Section>

							{/* What you'll get */}
							<Section className="mb-[24px]">
								<Text className="text-[#1a1a1a] text-[14px] font-medium m-0 mb-[12px]">
									As a team member, you'll be able to:
								</Text>
								<Text className="text-[#4b5563] text-[14px] leading-[24px] m-0 mb-[4px]">
									• Access shared documents and templates
								</Text>
								<Text className="text-[#4b5563] text-[14px] leading-[24px] m-0 mb-[4px]">
									• Collaborate with team members
								</Text>
								<Text className="text-[#4b5563] text-[14px] leading-[24px] m-0">
									• Send documents for signature
								</Text>
							</Section>

							{/* CTA Button */}
							<Section className="text-center my-[32px]">
								<Button
									className="bg-[#0f172a] rounded-lg text-white text-[16px] font-medium no-underline text-center px-[32px] py-[14px]"
									href={inviteUrl}
								>
									Accept Invitation
								</Button>
							</Section>

							<Text className="text-[#6b7280] text-[14px] leading-[22px] m-0 mb-[16px]">
								Or copy and paste this link into your browser:
							</Text>
							<Link
								href={inviteUrl}
								className="text-[#2563eb] text-[14px] break-all"
							>
								{inviteUrl}
							</Link>
						</Section>

						<Hr className="border-[#e6ebf1] my-[24px]" />

						{/* Footer */}
						<Section>
							<Text className="text-[#9ca3af] text-[12px] leading-[20px] m-0">
								This invitation was sent to {inviteeEmail}. If you don't want to
								join this team, you can safely ignore this email.
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

export default TeamInvitation;
