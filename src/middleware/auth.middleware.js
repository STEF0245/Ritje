/**
 * @file Authentication middleware for session hydration and admin checks.
 * @brief  Resolves the current Firebase user and attaches a normalized user object.
 * @details  Reads session tokens from cookies, validates Firebase identity, enriches request state, and enforces admin access where needed.
 */

import { verifyIdToken, auth } from '../firebase/auth.js'
import db from '../firebase/db.js'
import config from '../config.js'
import {
	createNotification,
	setFlashNotification
} from '../utils/notification.util.js'
import { sendVerificationEmail } from '../auth/auth.controller.js'

/**
 * @brief  Determine whether a request path can bypass authentication.
 * @details  Matches the request path against configured auth-free endpoints.
 * @param {string} path - Request path.
 * @returns {boolean} True when the path is explicitly auth-free.
 */
const isPathAuthFree = (path) => {
	return config.authFreeEndpoints && config.authFreeEndpoints.includes(path)
}

/**
 * @brief  Map Firebase and database user records into a single request user object.
 * @details  Combines authentication fields and profile metadata while providing safe defaults for missing data.
 * @param {object} firebaseUser - Firebase Auth user record.
 * @param {object} dbUser - User metadata from Realtime Database.
 * @param {boolean} admin - Whether the user has admin access.
 * @param {string} idToken - Verified Firebase ID token from the session cookie.
 * @returns {object} Normalized authenticated user object.
 */
const mapUserData = (firebaseUser, dbUser, admin, idToken) => {
	return {
		uid: firebaseUser?.uid,
		email: firebaseUser?.email || dbUser?.email || '',
		phoneNumber: firebaseUser?.phoneNumber || dbUser?.phoneNumber || '',
		displayName: firebaseUser?.displayName || dbUser?.name?.full || '',
		photoURL: firebaseUser?.photoURL || dbUser?.photoURL || '',
		emailVerified: firebaseUser?.emailVerified || false,
		createdAt:
			firebaseUser?.metadata?.creationTime || dbUser?.createdAt || '',
		lastSignInTime: firebaseUser?.metadata?.lastSignInTime || '',
		idToken: idToken || '',
		disabled: firebaseUser?.disabled || false,
		metadata: dbUser || {},
		isAdmin: admin || false
	}
}

/**
 * @brief  Hydrate the authenticated user from the session cookie.
 * @details  Redirects unauthenticated requests to login unless the endpoint is explicitly public.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @param {Function} next - Express next middleware callback.
 * @returns {Promise<void>} Resolves when authentication has been processed.
 * @throws {Error} Throws if token verification or data lookup fails unexpectedly.
 */
export const requireAuth = async (req, res, next) => {
	try {
		const idToken = req.cookies.token
		if (!idToken) {
			if (isPathAuthFree(req.path)) return next()
			return res.status(401).redirect('/login')
		}
		const decodedToken = await verifyIdToken(idToken, true) // Pass true to check if token is revoked
		const user = await auth.getUser(decodedToken.uid) // Fetch user details to check if account is disabled
		if (user.disabled) {
			return res.status(403).json({ message: 'Account is disabled' })
		}

		const [userSnapshot, adminSnapshot] = await Promise.all([
			db.ref(`users/${user.uid}`).once('value'),
			db.ref(`admins/${user.uid}`).once('value')
		])

		const userData = userSnapshot.val() || {}
		const admin = adminSnapshot.val() === true

		req.user = mapUserData(user, userData, admin, idToken)

		if (req.user && !req.user.emailVerified) {
			setFlashNotification(
				res,
				createNotification(
					'warning',
					'Waarschuwing',
					'Gelieve uw e-mailadres te verifiëren'
				)
			)
			await sendVerificationEmail(idToken).catch((err) => {
				console.error('Error sending verification email:', err.message)
			})
		}

		if (req.path === '/login') return res.redirect('/ride')
		next()
	} catch (err) {
		console.error('Authentication error:', err.message)
		if (isPathAuthFree(req.path)) return next()
		return res.status(401).redirect('/login')
	}
}

/**
 * @brief  Require the current user to have admin privileges.
 * @details  Expects `requireAuth` to have already populated `req.user` and rejects non-admin requests.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @param {Function} next - Express next middleware callback.
 * @returns {object|void} Calls next on success or sends a 403 response.
 */
export const requireAdmin = (req, res, next) => {
	if (req.user?.isAdmin) {
		return next()
	}
	const error = new Error('Toegang geweigerd')
	error.statusCode = 403
	throw error
}

export default requireAuth
