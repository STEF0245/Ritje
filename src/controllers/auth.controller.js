import { verifyIdToken } from '../firebase/auth.js'
import config from '../config.js'

export const getLoginPage = (req, res) => {
	res.render('login', {
		title: 'Login'
	})
}

export const loginController = async (req, res) => {
	const { idToken } = req.body
	try {
		if (!idToken) {
			return res.status(400).render('login', {
				title: 'Login',
				pageError: {
					status: 400,
					message: 'Inloggen mislukt. Probeer opnieuw.'
				}
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
		res.status(401).render('login', {
			title: 'Login',
			pageError: {
				status: 401,
				message:
					'Ongeldige login. Controleer je gegevens en probeer opnieuw.'
			}
		})
	}
}

export const logoutController = (req, res) => {
	res.clearCookie('token', {
		httpOnly: true,
		secure: config.isProduction,
		sameSite: 'strict'
	})
	res.redirect('/login')
}
