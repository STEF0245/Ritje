import {
	hasRequiredLoginFields,
	hasRequiredRegisterFields,
	registerWithPassword,
	signIn,
	signOut
} from './auth.service.js'

export const getLoginPage = (req, res) => {
	if (res.locals.user) {
		return res.redirect('/')
	}

	res.render('auth_login', {
		title: 'Inloggen'
	})
}

export const getRegisterPage = (req, res) => {
	if (res.locals.user) {
		return res.redirect('/')
	}

	res.render('auth_register', {
		title: 'Registreren'
	})
}

export const registerController = async (req, res) => {
	try {
		if (!hasRequiredRegisterFields(req.body)) {
			return res.redirect('/auth/register')
		}

		const { data, error } = await registerWithPassword(req.body)

		if (error) {
			return res.redirect('/auth/register')
		}

		if (data?.session) {
			return res.redirect('/')
		}

		if (isLikelyExistingUserSignup(data)) {
			return res.redirect('/auth/login')
		}

		return res.redirect('/auth/login')
	} catch (error) {
		console.error('Register route error:', error)
		return res.redirect('/auth/register')
	}
}

export const loginController = async (req, res) => {
	try {
		if (!hasRequiredLoginFields(req.body)) {
			return res.redirect('/auth/login')
		}

		const { data, error } = await signIn(req, res)

		if (error || !data?.session) {
			return res.redirect('/auth/login')
		}

		return res.redirect('/')
	} catch (error) {
		console.error('Login route error:', error)
		return res.redirect('/auth/login')
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
