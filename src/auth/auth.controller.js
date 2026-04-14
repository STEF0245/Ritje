/**
 * @file Authentication controller for login and logout flows.
 * @brief  Verifies Firebase tokens and manages the session cookie.
 * @details  Provides handlers for rendering login, verifying ID tokens, issuing secure session cookies, and clearing sessions on logout.
 */

import { verifyIdToken, auth } from '../firebase/auth.js'
import config from '../config.js'
import { renderWithErrorNotification } from '../utils/notification.util.js'

/**
 * @brief  Render the login page.
 * @details  Returns the login template for unauthenticated users.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @returns {object} Express response.
 */
export const getLoginPage = (req, res) => {
	res.render('login', {
		title: 'Login'
	})
}

/**
 * @brief  Verify the Firebase token and establish the session cookie.
 * @details  Validates the posted ID token, stores it in an HTTP-only cookie, and redirects the user to their profile.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @returns {Promise<object>} Express response.
 * @throws {Error} Throws when token verification fails.
 */
export const loginController = async (req, res) => {
	const { idToken } = req.body
	try {
		if (!idToken) {
			return renderWithErrorNotification(res, {
				status: 400,
				view: 'login',
				title: 'Login',
				message: 'Inloggen mislukt. Probeer opnieuw.'
			})
		}
		// Verify the token to ensure it is valid
		await verifyIdToken(idToken, true) // Pass true to check if token is revoked

		res.cookie('token', idToken, {
			httpOnly: true,
			secure: config.isProduction,
			sameSite: 'strict',
			maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
		})
		res.redirect('/profile')
	} catch (err) {
		console.error('Login error:', err.message)
		return renderWithErrorNotification(res, {
			status: 401,
			view: 'login',
			title: 'Login',
			message:
				'Ongeldige login. Controleer je gegevens en probeer opnieuw.'
		})
	}
}

/**
 * @brief  Clear the session cookie and redirect to the login page.
 * @details  Removes the authentication cookie using the same security attributes that were used during creation.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @returns {object} Express response.
 */
export const logoutController = (req, res) => {
	res.clearCookie('token', {
		httpOnly: true,
		secure: config.isProduction,
		sameSite: 'strict'
	})
	res.redirect('/login')
}

/**
 * @brief  Get the user's ID token.
 * @details  Returns the ID token from the authenticated user's session cookie.
 *           The token is used by the client for Firebase API operations.
 * @param {object} req - Express request with authenticated user (from middleware).
 * @param {object} res - Express response.
 * @returns {Promise<object>} JSON with idToken.
 */
export const getIdTokenController = async (req, res) => {
	try {
		if (!req.get('cookie')) {
			return res.status(401).json({
				message: 'Niet geverifieerd.'
			})
		}

		// The token is stored in the cookie. We need to get it from the request
		// The auth middleware has already verified it, so we can trust it
		const token = req.cookies.token

		if (!token) {
			return res.status(401).json({
				message: 'Geen token gevonden.'
			})
		}

		console.log(`[Auth] Returning ID token for ${req.user?.uid}`)

		res.json({
			idToken: token
		})
	} catch (error) {
		console.error('[Auth] Error getting ID token:', error)
		res.status(500).json({
			message: 'Er is een fout opgetreden.'
		})
	}
}
