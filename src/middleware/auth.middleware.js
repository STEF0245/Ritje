import { verifyIdToken } from '../firebase/auth.js'

const requireAuth = async (req, res, next) => {
	try {
		const idToken = req.cookies.token
		if (!idToken) {
			if (req.path === '/login') return next()
			return res
				.status(401)
				.json({ message: 'Unauthorized: No token provided' })
		}
		const user = await verifyIdToken(idToken, true) // Pass true to check if token is revoked
		console.log('Authenticated user:', user.email)
		req.user = user

		if (req.path === '/login') return res.redirect('/')

		next()
	} catch (err) {
		console.error('Authentication error:', err.message)
		if (req.path === '/login') return next()
		return res.status(401).json({ message: 'Unauthorized: Invalid token' })
	}
}
export default requireAuth
