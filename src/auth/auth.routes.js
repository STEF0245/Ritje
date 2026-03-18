import express from 'express'
import { config } from '../config/env.config.js'
import { supabase } from '../config/supabase.client.js'

const router = express.Router()
const AUTH_ERROR_COOKIE = 'auth-error-reason'
const ACCESS_TOKEN_COOKIE = 'sb-access-token'
const REFRESH_TOKEN_COOKIE = 'sb-refresh-token'

const cookieOptions = {
	httpOnly: true,
	sameSite: 'lax',
	secure: config.isProduction
}

const setAuthError = (res, message) => {
	res.cookie(AUTH_ERROR_COOKIE, message, {
		...cookieOptions,
		maxAge: 20 * 1000
	})
}

const setAuthCookies = (res, session) => {
	if (!session?.access_token || !session?.refresh_token) {
		return
	}

	res.cookie(ACCESS_TOKEN_COOKIE, session.access_token, {
		...cookieOptions,
		maxAge: (session.expires_in || 3600) * 1000
	})
	res.cookie(REFRESH_TOKEN_COOKIE, session.refresh_token, {
		...cookieOptions,
		maxAge: 30 * 24 * 60 * 60 * 1000
	})
}

const clearAuthCookies = (res) => {
	res.clearCookie(ACCESS_TOKEN_COOKIE)
	res.clearCookie(REFRESH_TOKEN_COOKIE)
}

const consumeAuthReason = (req, res) => {
	const authErrorReason = req.cookies[AUTH_ERROR_COOKIE] || null
	if (authErrorReason) {
		res.clearCookie(AUTH_ERROR_COOKIE)
	}
	return authErrorReason
}

router.get('/login', (req, res) => {
	const authErrorReason = consumeAuthReason(req, res)

	res.render('auth_login', {
		title: 'Inloggen',
		authErrorReason
	})
})

router.get('/register', (req, res) => {
	const authErrorReason = consumeAuthReason(req, res)

	res.render('auth_register', {
		title: 'Registreren',
		authErrorReason
	})
})

router.post('/register', async (req, res) => {
	try {
		const {
			email,
			password,
			firstname,
			lastname,
			street,
			house_number,
			postal_code,
			city,
			country,
			address,
			latitude,
			longitude
		} = req.body

		if (!email || !password || !firstname || !lastname) {
			setAuthError(
				res,
				'Vul alle verplichte velden in om te registreren.'
			)
			return res.redirect('/auth/register')
		}

		const { data, error } = await supabase.auth.signUp({
			email,
			password,
			options: {
				data: {
					first_name: firstname,
					last_name: lastname,
					address,
					street,
					house_number,
					postal_code,
					city,
					country,
					latitude,
					longitude
				}
			}
		})

		if (error) {
			setAuthError(res, error.message)
			return res.redirect('/auth/register')
		}

		if (data?.session) {
			setAuthCookies(res, data.session)
			return res.redirect('/')
		}

		setAuthError(
			res,
			'Controleer je e-mail om je account te bevestigen en log daarna in.'
		)
		return res.redirect('/auth/login')
	} catch (error) {
		console.error('Register route error:', error)
		setAuthError(
			res,
			'Registreren is momenteel niet beschikbaar. Probeer opnieuw.'
		)
		return res.redirect('/auth/register')
	}
})

router.post('/login', async (req, res) => {
	try {
		const { email, password } = req.body

		if (!email || !password) {
			setAuthError(res, 'Vul je e-mail en wachtwoord in om in te loggen.')
			return res.redirect('/auth/login')
		}

		const { data, error } = await supabase.auth.signInWithPassword({
			email,
			password
		})

		if (error || !data?.session) {
			clearAuthCookies(res)
			setAuthError(
				res,
				error?.message ||
					'Inloggen is mislukt. Controleer je gegevens en probeer opnieuw.'
			)
			return res.redirect('/auth/login')
		}

		setAuthCookies(res, data.session)
		return res.redirect('/')
	} catch (error) {
		console.error('Login route error:', error)
		clearAuthCookies(res)
		setAuthError(
			res,
			'Inloggen is momenteel niet beschikbaar. Probeer opnieuw.'
		)
		return res.redirect('/auth/login')
	}
})

export default router
