import { supabase } from '../config/supabase.client.js'

const AUTH_ERROR_COOKIE = 'auth-error-reason'

const redirectToLoginWithReason = (res, reason) => {
	res.cookie(AUTH_ERROR_COOKIE, reason, {
		httpOnly: true,
		sameSite: 'lax',
		maxAge: 15 * 1000
	})
	res.setHeader('Error-Reason', reason)
	return res.redirect('/auth/login')
}

export const optionalAuth = async (req, res, next) => {
	try {
		const accessToken = req.cookies['sb-access-token']

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
		const accessToken = req.cookies['sb-access-token']
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
			res.clearCookie('sb-access-token')
			res.clearCookie('sb-refresh-token')
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
