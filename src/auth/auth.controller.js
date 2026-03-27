import { hasRequiredLoginFields, signIn, signOut } from './auth.service.js'
import { randomBytes } from 'node:crypto'
import { config } from '../config/env.config.js'

const CSRF_COOKIE_NAME = 'csrfToken'

const getCsrfCookieOptions = () => ({
	httpOnly: false,
	secure: config.isProduction,
	sameSite: 'lax',
	maxAge: 60 * 60 * 1000
})

const getLoginFeedback = (query = {}) => {
	if (query.status === 'registered') {
		return {
			authErrorType: 'info',
			authErrorReason:
				'Je account is aangemaakt. Log nu in om verder te gaan.'
		}
	}

	if (query.error === 'missing_token') {
		return {
			authErrorType: 'error',
			authErrorReason:
				'Loginvalidatie ontbreekt. Herlaad de pagina en probeer opnieuw.'
		}
	}

	if (query.error === 'login_failed') {
		return {
			authErrorType: 'error',
			authErrorReason:
				'Inloggen is mislukt. Controleer je gegevens en probeer opnieuw.'
		}
	}

	return { authErrorType: null, authErrorReason: null }
}

const getRegisterFeedback = (query = {}) => {
	if (query.error === 'missing_fields') {
		return {
			authErrorType: 'error',
			authErrorReason:
				'Vul alle verplichte velden in voordat je registreert.'
		}
	}

	if (query.error === 'register_failed') {
		return {
			authErrorType: 'error',
			authErrorReason:
				'Registreren is mislukt. Bestaat het account al of is het wachtwoord te zwak?'
		}
	}

	return { authErrorType: null, authErrorReason: null }
}

export const getLoginPage = (req, res) => {
	if (res.locals.user) {
		return res.redirect('/')
	}

	const { authErrorType, authErrorReason } = getLoginFeedback(req.query)

	const csrfToken = randomBytes(32).toString('hex')
	res.cookie(CSRF_COOKIE_NAME, csrfToken, getCsrfCookieOptions())

	res.render('auth_login', {
		title: 'Inloggen',
		csrfToken,
		firebaseConfig: config.firebase.web,
		authErrorType,
		authErrorReason
	})
}

export const loginController = async (req, res) => {
	try {
		if (!hasRequiredLoginFields(req.body)) {
			return res.redirect('/auth/login?error=missing_token')
		}

		const { data, error } = await signIn(req, res)

		if (error || !data?.session) {
			return res.redirect('/auth/login?error=login_failed')
		}

		return res.redirect('/')
	} catch (error) {
		console.error('Login route error:', error)
		return res.redirect('/auth/login?error=login_failed')
	}
}

export const logoutController = async (req, res) => {
	try {
		signOut(req, res)
	} catch (error) {
		console.error('Logout error:', error)
	}
	return res.redirect('/auth/login')
}
