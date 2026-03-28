import auth from '../firebase/auth.js'

const requireAuth = async (req, res, next) => {
	try {
		if (req.path === '/login') {
			return next() // Skip auth check for /login route
		}

		const idToken = req.cookies.token
		if (!idToken) {
			return res
				.status(401)
				.json({ message: 'Unauthorized: No token provided' })
		}
		const user = await auth.verifyIdToken(idToken, true) // Pass true to check if token is revoked
		console.log('Authenticated user:', user)
		req.user = user
		next()
	} catch (err) {
		console.error('Authentication error:', err)
		return res.status(401).json({ message: 'Unauthorized: Invalid token' })
	}
}
export default requireAuth
