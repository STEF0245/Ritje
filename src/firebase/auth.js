/**
 * @file Firebase Auth helpers for token verification and ID generation.
 * @brief Exposes the Firebase Admin auth instance and related utility functions.
 */

import { randomBytes } from 'node:crypto'
import { getAuth } from 'firebase-admin/auth'
import app from './app.js'

export const auth = getAuth(app)

export const generateRandomUid = () => {
	return randomBytes(6).toString('base64url').slice(0, 8)
}

/**
 * @brief Verify a Firebase ID token and optionally check whether it was revoked.
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
