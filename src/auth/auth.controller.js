import {
	clearAuthCookies,
	consumeAuthReason,
	hasRequiredLoginFields,
	hasRequiredRegisterFields,
	loginWithPassword,
	registerWithPassword,
	setAuthCookies,
	setAuthError
} from './auth.service.js'

export const getLoginPage = (req, res) => {
	const authErrorReason = consumeAuthReason(req, res)

	res.render('auth_login', {
		title: 'Inloggen',
		authErrorReason
	})
}

export const getRegisterPage = (req, res) => {
	const authErrorReason = consumeAuthReason(req, res)

	res.render('auth_register', {
		title: 'Registreren',
		authErrorReason
	})
}

export const registerController = async (req, res) => {
	try {
		if (!hasRequiredRegisterFields(req.body)) {
			setAuthError(
				res,
				'Vul alle verplichte velden in om te registreren.'
			)
			return res.redirect('/auth/register')
		}

		const { data, error } = await registerWithPassword(req.body)

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
}

export const loginController = async (req, res) => {
	try {
		if (!hasRequiredLoginFields(req.body)) {
			setAuthError(res, 'Vul je e-mail en wachtwoord in om in te loggen.')
			return res.redirect('/auth/login')
		}

		const { data, error } = await loginWithPassword(req.body)

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
}
