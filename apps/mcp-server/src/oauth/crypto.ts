/**
 * OAuth Cryptographic Utilities
 *
 * Provides secure token generation, hashing, and JWT operations.
 */

import type { AccessTokenPayload } from "./types";

// ============================================================================
// Configuration
// ============================================================================

const JWT_ALGORITHM = "HS256";
const ACCESS_TOKEN_TTL = 3600; // 1 hour in seconds
const REFRESH_TOKEN_TTL = 30 * 24 * 3600; // 30 days in seconds
const AUTH_CODE_TTL = 600; // 10 minutes in seconds

/**
 * Get the JWT secret from environment variables
 */
function getJwtSecret(): string {
	const secret = process.env.MCP_JWT_SECRET;
	if (!secret) {
		throw new Error("MCP_JWT_SECRET environment variable is not set");
	}
	return secret;
}

/**
 * Get access token TTL from environment or use default
 */
export function getAccessTokenTTL(): number {
	const ttl = process.env.MCP_ACCESS_TOKEN_TTL;
	return ttl ? Number.parseInt(ttl, 10) : ACCESS_TOKEN_TTL;
}

/**
 * Get refresh token TTL from environment or use default (0 = never expires)
 */
export function getRefreshTokenTTL(): number {
	const ttl = process.env.MCP_REFRESH_TOKEN_TTL;
	return ttl ? Number.parseInt(ttl, 10) : REFRESH_TOKEN_TTL;
}

/**
 * Get authorization code TTL from environment or use default
 */
export function getAuthCodeTTL(): number {
	const ttl = process.env.MCP_AUTH_CODE_TTL;
	return ttl ? Number.parseInt(ttl, 10) : AUTH_CODE_TTL;
}

// ============================================================================
// Random Generation
// ============================================================================

/**
 * Generate a cryptographically secure random string
 */
function generateSecureRandom(bytes = 32): string {
	const array = new Uint8Array(bytes);
	crypto.getRandomValues(array);
	return base64UrlEncode(array);
}

/**
 * Generate a client ID (UUID v4)
 */
export function generateClientId(): string {
	return crypto.randomUUID();
}

/**
 * Generate a client secret
 */
export function generateClientSecret(): string {
	return generateSecureRandom(32);
}

/**
 * Generate an authorization code
 */
export function generateAuthorizationCode(): string {
	return generateSecureRandom(32);
}

/**
 * Generate a refresh token
 */
export function generateRefreshToken(): string {
	return generateSecureRandom(32);
}

// ============================================================================
// Hashing
// ============================================================================

/**
 * Hash a token using SHA-256
 */
export async function hashToken(token: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(token);
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);
	return base64UrlEncode(new Uint8Array(hashBuffer));
}

/**
 * Verify a token against its hash
 */
export async function verifyTokenHash(
	token: string,
	hash: string,
): Promise<boolean> {
	const computedHash = await hashToken(token);
	return timingSafeEqual(computedHash, hash);
}

// ============================================================================
// PKCE (Proof Key for Code Exchange)
// ============================================================================

/**
 * Verify PKCE code verifier against challenge
 */
export async function verifyPKCE(
	codeVerifier: string,
	codeChallenge: string,
	codeChallengeMethod: string,
): Promise<boolean> {
	if (codeChallengeMethod === "plain") {
		return timingSafeEqual(codeVerifier, codeChallenge);
	}

	if (codeChallengeMethod === "S256") {
		const encoder = new TextEncoder();
		const data = encoder.encode(codeVerifier);
		const hashBuffer = await crypto.subtle.digest("SHA-256", data);
		const computedChallenge = base64UrlEncode(new Uint8Array(hashBuffer));
		return timingSafeEqual(computedChallenge, codeChallenge);
	}

	return false;
}

// ============================================================================
// JWT Operations
// ============================================================================

/**
 * Sign a JWT access token
 */
export async function signAccessToken(
	payload: Omit<AccessTokenPayload, "iat" | "exp">,
): Promise<string> {
	const secret = getJwtSecret();
	const now = Math.floor(Date.now() / 1000);
	const ttl = getAccessTokenTTL();

	const fullPayload: AccessTokenPayload = {
		...payload,
		iat: now,
		exp: now + ttl,
	};

	return signJWT(fullPayload, secret);
}

/**
 * Verify and decode a JWT access token
 */
export async function verifyAccessToken(
	token: string,
): Promise<AccessTokenPayload | null> {
	const secret = getJwtSecret();

	try {
		const payload = await verifyJWT<AccessTokenPayload>(token, secret);

		// Check expiration
		const now = Math.floor(Date.now() / 1000);
		if (payload.exp < now) {
			return null;
		}

		return payload;
	} catch {
		return null;
	}
}

// ============================================================================
// Low-level JWT Implementation
// ============================================================================

interface JWTHeader {
	alg: string;
	typ: string;
}

async function signJWT(
	payload: AccessTokenPayload,
	secret: string,
): Promise<string> {
	const header: JWTHeader = { alg: JWT_ALGORITHM, typ: "JWT" };

	const encodedHeader = base64UrlEncode(
		new TextEncoder().encode(JSON.stringify(header)),
	);
	const encodedPayload = base64UrlEncode(
		new TextEncoder().encode(JSON.stringify(payload)),
	);

	const signingInput = `${encodedHeader}.${encodedPayload}`;

	const signature = await hmacSHA256(signingInput, secret);

	return `${signingInput}.${signature}`;
}

async function verifyJWT<T>(token: string, secret: string): Promise<T> {
	const parts = token.split(".");
	if (parts.length !== 3) {
		throw new Error("Invalid JWT format");
	}

	const encodedHeader = parts[0];
	const encodedPayload = parts[1];
	const signature = parts[2];

	if (!encodedHeader || !encodedPayload || !signature) {
		throw new Error("Invalid JWT format");
	}

	// Verify signature
	const signingInput = `${encodedHeader}.${encodedPayload}`;
	const expectedSignature = await hmacSHA256(signingInput, secret);

	if (!timingSafeEqual(signature, expectedSignature)) {
		throw new Error("Invalid JWT signature");
	}

	// Decode payload
	const payloadJson = new TextDecoder().decode(base64UrlDecode(encodedPayload));
	return JSON.parse(payloadJson) as T;
}

async function hmacSHA256(message: string, secret: string): Promise<string> {
	const encoder = new TextEncoder();
	const keyData = encoder.encode(secret);
	const messageData = encoder.encode(message);

	const key = await crypto.subtle.importKey(
		"raw",
		keyData,
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);

	const signature = await crypto.subtle.sign("HMAC", key, messageData);
	return base64UrlEncode(new Uint8Array(signature));
}

// ============================================================================
// Base64URL Encoding/Decoding
// ============================================================================

function base64UrlEncode(data: Uint8Array): string {
	const base64 = btoa(String.fromCharCode(...data));
	return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str: string): Uint8Array {
	// Add padding if needed
	let padded = str.replace(/-/g, "+").replace(/_/g, "/");
	while (padded.length % 4 !== 0) {
		padded += "=";
	}

	const binary = atob(padded);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

// ============================================================================
// Timing-Safe Comparison
// ============================================================================

function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) {
		return false;
	}

	let result = 0;
	for (let i = 0; i < a.length; i++) {
		result |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}

	return result === 0;
}
