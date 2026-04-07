/**
 * @file Authentication middleware for session hydration and admin checks.
 * @brief Resolves the current Firebase user and attaches a normalized user object.
 */

import { verifyIdToken, auth } from '../firebase/auth.js'
import db from '../firebase/db.js'
import config from '../config.js'

const isPathAuthFree = (path) => {
	return config.authFreeEndpoints && config.authFreeEndpoints.includes(path)
}

const mapUserData = (firebaseUser, dbUser, admin) => {
	return {
		uid: firebaseUser?.uid,
		email: firebaseUser?.email || dbUser?.email || '',
		phoneNumber: firebaseUser?.phoneNumber || dbUser?.phoneNumber || '',
		displayName: dbUser?.name?.full || firebaseUser?.displayName || '',
		photoURL: firebaseUser?.photoURL || dbUser?.photoURL || '',
		emailVerified:
			dbUser?.emailVerified || firebaseUser?.emailVerified || false,
		createdAt:
			firebaseUser?.metadata?.creationTime || dbUser?.createdAt || '',
		lastSignInTime:
			firebaseUser?.metadata?.lastSignInTime ||
			dbUser?.lastSignInTime ||
			'',
		disabled: firebaseUser?.disabled || false,
		metadata: dbUser || {},
		isAdmin: admin || false
	}
}

/**
 * @brief Hydrate the authenticated user from the session cookie.
 * @details Redirects unauthenticated requests to login unless the endpoint is explicitly public.
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

		req.user = mapUserData(user, userData, admin)

		if (req.path === '/login') return res.redirect('/profile')
		next()
	} catch (err) {
		console.error('Authentication error:', err.message)
		if (isPathAuthFree(req.path)) return next()
		return res.status(401).redirect('/login')
	}
}

/**
 * @brief Require the current user to have admin privileges.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @param {Function} next - Express next middleware callback.
 * @returns {object|void} Calls next on success or sends a 403 response.
 */
export const requireAdmin = (req, res, next) => {
	if (req.user?.isAdmin) {
		return next()
	}
	return res.status(403).json({ message: 'Admin access required' })
}

export default requireAuth
