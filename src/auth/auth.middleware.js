import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from './auth.constants.js'
import {
	clearAuthCookies,
	getUserFromAccessToken,
	refreshSession,
	setAuthCookies,
	setAuthError
} from './auth.service.js'

const redirectToLoginWithReason = (res, reason, type) => {
	setAuthError(res, reason, type, 15 * 1000)
	return res.redirect('/auth/login')
}

const refreshUserSession = async (req, res) => {
	const refreshToken = req.cookies[REFRESH_TOKEN_COOKIE]
	if (!refreshToken) {
		return null
	}

	const { data, error } = await refreshSession(refreshToken)
	if (error || !data?.session?.access_token) {
		return null
	}

	setAuthCookies(res, data.session)
	return getUserFromAccessToken(data.session.access_token)
}

export const optionalAuth = async (req, res, next) => {
	try {
		const accessToken = req.cookies[ACCESS_TOKEN_COOKIE]
		let user = null

		if (accessToken) {
			try {
				user = await getUserFromAccessToken(accessToken)
			} catch {
				user = null
			}
		}

		if (!user) {
			user = await refreshUserSession(req, res)
		}

		if (!user) {
			clearAuthCookies(res)
		}

		req.user = user || null

		next()
	} catch (error) {
		clearAuthCookies(res)
		req.user = null
		next()
	}
}

export const requireAuth = async (req, res, next) => {
	try {
		const accessToken = req.cookies[ACCESS_TOKEN_COOKIE]
		let user = null

		if (accessToken) {
			try {
				user = await getUserFromAccessToken(accessToken)
			} catch {
				user = null
			}
		}

		if (!user) {
			user = await refreshUserSession(req, res)
		}

		if (!user) {
			clearAuthCookies(res)
			return redirectToLoginWithReason(
				res,
				'Je moet ingelogd zijn om deze pagina te bekijken.',
				'error'
			)
		}

		req.user = user
		next()
	} catch (error) {
		console.error('Authentication middleware error:', error)
		return redirectToLoginWithReason(
			res,
			'Er is een fout opgetreden bij authenticatie. Probeer het opnieuw.',
			'error'
		)
	}
}
