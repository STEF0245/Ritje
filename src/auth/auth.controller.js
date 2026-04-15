/**
 * @file Authentication controller for login and logout flows.
 * @brief  Verifies Firebase tokens and manages the session cookie.
 * @details  Provides handlers for rendering login, verifying ID tokens, issuing secure session cookies, and clearing sessions on logout.
 */

import { verifyIdToken } from '../firebase/auth.js'
import config from '../config.js'
import { respondWithNotification } from '../utils/notification.util.js'

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
			return respondWithNotification(res, {
				type: 'error',
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
		return respondWithNotification(res, {
			type: 'error',
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
 * @brief  Resend the Firebase email verification message.
 * @details  Uses the authenticated session token from `req.user` to request a verification email via Firebase Identity Toolkit.
 * @param {object} req - Express request with authenticated user.
 * @param {object} res - Express response object.
 * @returns {Promise<object>} JSON success or error response.
 */
export const resendVerificationEmailController = async (req, res) => {
	try {
		const idToken = req.user?.idToken
		if (!idToken) {
			return res.status(401).redirect('/login')
		}

		if (req.user.emailVerified) {
			return respondWithNotification(res, {
				type: 'error',
				message: 'E-mailadres is al geverifieerd.',
				redirectTo: '/profile'
			})
		}

		const response = await fetch(
			`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${config.firebase.web.apiKey}`,
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					requestType: 'VERIFY_EMAIL',
					idToken
				})
			}
		)

		if (!response.ok) {
			const errorBody = await response.json().catch(() => null)
			const message =
				errorBody?.error?.message ||
				'Er is een fout opgetreden bij het verzenden van de verificatie-e-mail.'
			return respondWithNotification(res, {
				type: 'error',
				message,
				redirectTo: '/profile'
			})
		}

		return respondWithNotification(res, {
			type: 'success',
			message: 'Verificatie-e-mail is opnieuw verzonden.',
			redirectTo: '/profile'
		})
	} catch (error) {
		console.error('[Auth] Resend verification email error:', error)
		return respondWithNotification(res, {
			type: 'error',
			message:
				'Er is een fout opgetreden bij het verzenden van de verificatie-e-mail.',
			redirectTo: '/profile'
		})
	}
}
