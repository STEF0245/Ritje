import auth from '../firebase/auth.js'

const requireAuth = async (req, res, next) => {
	try {
		if (req.path.startsWith('/auth')) {
			return next() // Skip auth check for /auth routes
		}

		const token = req.cookies.token
		if (!token) {
			return res
				.status(401)
				.json({ message: 'Unauthorized: No token provided' })
		}
		const user = await auth.verifyToken(token, true) // Pass true to check if token is revoked
		req.user = user
		next()
	} catch (err) {
		console.error('Authentication error:', err)
		return res.status(401).json({ message: 'Unauthorized: Invalid token' })
	}
}
export default requireAuth
