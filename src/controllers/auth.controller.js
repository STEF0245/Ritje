import auth from '../services/auth.service.js'
import config from '../config.js'

export const getLoginPage = (req, res) => {
	res.render('auth_login', { title: 'Login' })
}

export const loginController = async (req, res) => {
	const { email, password } = req.body
	try {
		const token = await auth.login(email, password)
		res.cookie('token', token, {
			httpOnly: true,
			secure: config.isProduction,
			sameSite: 'strict',
			maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
		})
		res.json({ message: 'Login successful' })
	} catch (err) {
		console.error('Login error:', err)
		res.status(401).json({ message: 'Invalid email or password' })
	}
}

export const logoutController = (req, res) => {
	res.clearCookie('token', {
		httpOnly: true,
		secure: config.isProduction,
		sameSite: 'strict'
	})
	res.json({ message: 'Logout successful' })
}
