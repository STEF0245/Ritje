/**
 * @file Firebase Auth helpers for token verification and ID generation.
 * @brief  Exposes the Firebase Admin auth instance and related utility functions.
 * @details  Wraps core Firebase Admin Auth operations used by authentication middleware and admin user management flows.
 */

import { randomBytes } from 'node:crypto'
import { getAuth } from 'firebase-admin/auth'
import app from './app.js'

/**
 * @brief  Firebase Admin Auth instance for the application.
 * @type {import('firebase-admin/auth').Auth}
 */
export const auth = getAuth(app)

/**
 * @brief  Generate a random UID string for new users.
 * @details  Creates a URL-safe base64 string of 8 characters (6 bytes) for use as a Firebase UID.
 * @returns {string} A random 8-character UID string.
 */
export const generateRandomUid = () => {
	return randomBytes(6).toString('base64url').slice(0, 8)
}

/**
 * @brief  Verify a Firebase ID token and optionally check whether it was revoked.
 * @details  Uses the Firebase Admin SDK to verify the token's signature and validity. If `checkRevoked` is true, also checks if the token has been revoked, which is important for security when logging in.
 * @param {string} idToken - Firebase ID token from the client.
 * @param {boolean} [checkRevoked=true] - Whether to reject revoked tokens.
 * @returns {Promise<object>} Decoded Firebase token payload.
 * @throws {Error} Throws when token verification fails.
 */
export const verifyIdToken = async (idToken, checkRevoked = true) => {
	try {
		return await auth.verifyIdToken(idToken, checkRevoked)
	} catch (error) {
		if (error.code === 'auth/id-token-expired') {
			console.warn('Firebase token has expired:', error.message)
		} else if (error.code === 'auth/id-token-revoked') {
			console.warn('Firebase token has been revoked:', error.message)
		} else {
			console.error('Error verifying Firebase token:', error.message)
		}
		throw error
	}
}

export default auth
