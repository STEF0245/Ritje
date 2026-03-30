import { verifyIdToken } from '../firebase/auth.js'
import config from '../config.js'

const isAuthFree = (path) => {
	return config.authFreeEndpoints && config.authFreeEndpoints.includes(path)
}

const requireAuth = async (req, res, next) => {
	try {
		const idToken = req.cookies.token
		if (!idToken) {
			if (isAuthFree(req.path)) return next()
			return res.status(401).redirect('/login')
		}
		const user = await verifyIdToken(idToken, true) // Pass true to check if token is revoked
		console.log('Authenticated user:', user.email)
		req.user = user

		if (req.path === '/login') return res.redirect('/')

		next()
	} catch (err) {
		console.error('Authentication error:', err.message)
		if (isAuthFree(req.path)) return next()
		return res.status(401).json({ message: 'Unauthorized: Invalid token' })
	}
}
export default requireAuth
