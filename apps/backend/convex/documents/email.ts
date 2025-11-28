/**
 * Email sending utilities using Resend
 */

import { Resend } from "resend";

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

export interface SendDocumentInvitationParams {
	to: string;
	recipientName: string;
	documentName: string;
	senderName: string;
	signingUrl: string;
	customMessage?: string;
	expiresAt?: number;
}

/**
 * Send document invitation email to recipient
 */
export async function sendDocumentInvitation(
	params: SendDocumentInvitationParams,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
	try {
		const {
			to,
			recipientName,
			documentName,
			senderName,
			signingUrl,
			customMessage,
			expiresAt,
		} = params;

		// Format expiration date if provided
		const expirationText = expiresAt
			? `This document will expire on ${new Date(expiresAt).toLocaleDateString()}.`
			: "";

		const { data, error } = await resend.emails.send({
			from: process.env.RESEND_FROM_EMAIL || "Seal <no-reply@seal.nyc>",
			to: [to],
			subject: `${senderName} sent you a document to sign: ${documentName}`,
			html: `
				<!DOCTYPE html>
				<html>
					<head>
						<meta charset="utf-8">
						<meta name="viewport" content="width=device-width, initial-scale=1.0">
						<title>Document to Sign</title>
						<style>
							body {
								font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
								line-height: 1.6;
								color: #333;
								max-width: 600px;
								margin: 0 auto;
								padding: 20px;
								background-color: #f5f5f5;
							}
							.container {
								background-color: white;
								padding: 40px;
								border-radius: 8px;
								box-shadow: 0 2px 4px rgba(0,0,0,0.1);
							}
							.header {
								margin-bottom: 30px;
							}
							.logo {
								font-size: 24px;
								font-weight: bold;
								color: #0066cc;
								margin-bottom: 10px;
							}
							.greeting {
								font-size: 18px;
								margin-bottom: 20px;
							}
							.message {
								margin-bottom: 20px;
								padding: 15px;
								background-color: #f9f9f9;
								border-left: 4px solid #0066cc;
								border-radius: 4px;
							}
							.document-info {
								margin-bottom: 30px;
							}
							.document-name {
								font-size: 20px;
								font-weight: 600;
								color: #222;
								margin-bottom: 10px;
							}
							.button {
								display: inline-block;
								padding: 14px 32px;
								background-color: #0066cc;
								color: white;
								text-decoration: none;
								border-radius: 6px;
								font-weight: 600;
								font-size: 16px;
								margin: 20px 0;
							}
							.button:hover {
								background-color: #0052a3;
							}
							.expiration {
								color: #d97706;
								margin-top: 15px;
								font-size: 14px;
							}
							.footer {
								margin-top: 40px;
								padding-top: 20px;
								border-top: 1px solid #e5e5e5;
								font-size: 12px;
								color: #666;
							}
							.footer-link {
								color: #0066cc;
								text-decoration: none;
							}
						</style>
					</head>
					<body>
						<div class="container">
							<div class="header">
								<div class="logo">🔏 Seal</div>
							</div>

							<div class="greeting">
								Hello ${recipientName},
							</div>

							<p>
								<strong>${senderName}</strong> has sent you a document to sign.
							</p>

							${
								customMessage
									? `
								<div class="message">
									<strong>Message from ${senderName}:</strong><br>
									${customMessage}
								</div>
							`
									: ""
							}

							<div class="document-info">
								<div class="document-name">📄 ${documentName}</div>
							</div>

							<p>
								Click the button below to review and sign the document:
							</p>

							<a href="${signingUrl}" class="button">
								Review & Sign Document
							</a>

							${expirationText ? `<div class="expiration">⏰ ${expirationText}</div>` : ""}

							<p style="margin-top: 30px; font-size: 14px; color: #666;">
								Or copy and paste this link into your browser:<br>
								<a href="${signingUrl}" style="color: #0066cc; word-break: break-all;">${signingUrl}</a>
							</p>

							<div class="footer">
								<p>
									This email was sent by ${senderName} via Seal.<br>
									If you have any questions, please contact ${senderName} directly.
								</p>
								<p>
									<a href="https://seal.com" class="footer-link">Seal</a> - Simple, secure document signing
								</p>
							</div>
						</div>
					</body>
				</html>
			`,
		});

		if (error) {
			console.error("Error sending email:", error);
			return { success: false, error: error.message };
		}

		return { success: true, messageId: data?.id };
	} catch (error) {
		console.error("Unexpected error sending email:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

/**
 * Send document completion notification to sender
 */
export async function sendDocumentCompleted(params: {
	to: string;
	senderName: string;
	documentName: string;
	documentUrl: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
	try {
		const { to, senderName, documentName, documentUrl } = params;

		const { data, error } = await resend.emails.send({
			from: process.env.RESEND_FROM_EMAIL || "Seal <no-reply@seal.nyc>",
			to: [to],
			subject: `Document Completed: ${documentName}`,
			html: `
				<!DOCTYPE html>
				<html>
					<head>
						<meta charset="utf-8">
						<meta name="viewport" content="width=device-width, initial-scale=1.0">
						<title>Document Completed</title>
						<style>
							body {
								font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
								line-height: 1.6;
								color: #333;
								max-width: 600px;
								margin: 0 auto;
								padding: 20px;
								background-color: #f5f5f5;
							}
							.container {
								background-color: white;
								padding: 40px;
								border-radius: 8px;
								box-shadow: 0 2px 4px rgba(0,0,0,0.1);
							}
							.header {
								margin-bottom: 30px;
							}
							.logo {
								font-size: 24px;
								font-weight: bold;
								color: #0066cc;
								margin-bottom: 10px;
							}
							.success-banner {
								background-color: #10b981;
								color: white;
								padding: 20px;
								border-radius: 6px;
								text-align: center;
								font-size: 20px;
								font-weight: 600;
								margin-bottom: 30px;
							}
							.button {
								display: inline-block;
								padding: 14px 32px;
								background-color: #0066cc;
								color: white;
								text-decoration: none;
								border-radius: 6px;
								font-weight: 600;
								font-size: 16px;
								margin: 20px 0;
							}
							.footer {
								margin-top: 40px;
								padding-top: 20px;
								border-top: 1px solid #e5e5e5;
								font-size: 12px;
								color: #666;
							}
						</style>
					</head>
					<body>
						<div class="container">
							<div class="header">
								<div class="logo">🔏 Seal</div>
							</div>

							<div class="success-banner">
								✅ Document Signed Successfully!
							</div>

							<p>
								Hello ${senderName},
							</p>

							<p>
								Great news! All recipients have completed signing <strong>${documentName}</strong>.
							</p>

							<p>
								Your signed document is now ready for download:
							</p>

							<a href="${documentUrl}" class="button">
								View Signed Document
							</a>

							<div class="footer">
								<p>
									<a href="https://seal.com" style="color: #0066cc; text-decoration: none;">Seal</a> - Simple, secure document signing
								</p>
							</div>
						</div>
					</body>
				</html>
			`,
		});

		if (error) {
			console.error("Error sending completion email:", error);
			return { success: false, error: error.message };
		}

		return { success: true, messageId: data?.id };
	} catch (error) {
		console.error("Unexpected error sending completion email:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}
