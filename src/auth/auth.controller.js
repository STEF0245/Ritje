import {
	clearAuthCookies,
	consumeAuthReason,
	hasRequiredLoginFields,
	hasRequiredRegisterFields,
	isLikelyExistingUserSignup,
	loginWithPassword,
	registerWithPassword,
	logOut,
	setAuthCookies,
	setAuthError
} from './auth.service.js'
import { ACCESS_TOKEN_COOKIE } from './auth.constants.js'

export const getLoginPage = (req, res) => {
	const { authErrorReason, authErrorType } = consumeAuthReason(req, res)

	if (res.locals.user) {
		return res.redirect('/')
	}

	res.render('auth_login', {
		title: 'Inloggen',
		authErrorReason,
		authErrorType
	})
}

export const getRegisterPage = (req, res) => {
	const { authErrorReason, authErrorType } = consumeAuthReason(req, res)

	if (res.locals.user) {
		return res.redirect('/')
	}

	res.render('auth_register', {
		title: 'Registreren',
		authErrorReason,
		authErrorType
	})
}

export const registerController = async (req, res) => {
	try {
		if (!hasRequiredRegisterFields(req.body)) {
			setAuthError(
				res,
				'Vul alle verplichte velden in om te registreren.',
				'error'
			)
			return res.redirect('/auth/register')
		}

		const { data, error } = await registerWithPassword(req.body)

		if (error) {
			setAuthError(res, error.message, 'error')
			return res.redirect('/auth/register')
		}

		if (data?.session) {
			setAuthCookies(res, data.session)
			return res.redirect('/')
		}

		if (isLikelyExistingUserSignup(data)) {
			setAuthError(
				res,
				'Er bestaat al een account met dit e-mailadres. Log in of herstel je wachtwoord.',
				'warning'
			)
			return res.redirect('/auth/login')
		}

		setAuthError(
			res,
			'Controleer je e-mail om je account te bevestigen en log daarna in.',
			'info'
		)
		return res.redirect('/auth/login')
	} catch (error) {
		console.error('Register route error:', error)
		setAuthError(
			res,
			'Registreren is momenteel niet beschikbaar. Probeer opnieuw.',
			'error'
		)
		return res.redirect('/auth/register')
	}
}

export const loginController = async (req, res) => {
	try {
		if (!hasRequiredLoginFields(req.body)) {
			setAuthError(
				res,
				'Vul je e-mail en wachtwoord in om in te loggen.',
				'error'
			)
			return res.redirect('/auth/login')
		}

		const { data, error } = await loginWithPassword(req.body)

		if (error || !data?.session) {
			clearAuthCookies(res)
			setAuthError(
				res,
				error?.message ||
					'Inloggen is mislukt. Controleer je gegevens en probeer opnieuw.',
				'error'
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
			'Inloggen is momenteel niet beschikbaar. Probeer opnieuw.',
			'error'
		)
		return res.redirect('/auth/login')
	}
}

export const logoutController = async (req, res) => {
	try {
		await logOut(req.cookies[ACCESS_TOKEN_COOKIE])
	} catch (error) {
		console.error('Logout error:', error)
	}
	clearAuthCookies(res)
	return res.redirect('/auth/login')
}
