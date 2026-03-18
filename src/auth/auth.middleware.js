import { supabase } from '../config/supabase.client.js'
import { ACCESS_TOKEN_COOKIE } from './auth.constants.js'
import { clearAuthCookies, setAuthError } from './auth.service.js'

const redirectToLoginWithReason = (res, reason) => {
	setAuthError(res, reason, 15 * 1000)
	return res.redirect('/auth/login')
}

export const optionalAuth = async (req, res, next) => {
	try {
		const accessToken = req.cookies[ACCESS_TOKEN_COOKIE]

		if (accessToken) {
			const {
				data: { user }
			} = await supabase.auth.getUser(accessToken)
			req.user = user || null
		} else {
			req.user = null
		}

		next()
	} catch (error) {
		req.user = null
		next()
	}
}

export const requireAuth = async (req, res, next) => {
	try {
		const accessToken = req.cookies[ACCESS_TOKEN_COOKIE]
		if (!accessToken) {
			return redirectToLoginWithReason(
				res,
				'Je moet ingelogd zijn om deze pagina te bekijken.'
			)
		}

		const {
			data: { user },
			error
		} = await supabase.auth.getUser(accessToken)
		if (error || !user) {
			clearAuthCookies(res)
			return redirectToLoginWithReason(
				res,
				'Je sessie is verlopen. Log opnieuw in om verder te gaan.'
			)
		}

		req.user = user
		next()
	} catch (error) {
		console.error('Authentication middleware error:', error)
		return redirectToLoginWithReason(
			res,
			'Er is een fout opgetreden bij authenticatie. Probeer het opnieuw.'
		)
	}
}
