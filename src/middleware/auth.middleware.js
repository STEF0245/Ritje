import { verifyIdToken } from '../firebase/auth.js'
import { getUserRef } from '../firebase/db.js'
import config from '../config.js'

const isAuthFree = (path) => {
	return config.authFreeEndpoints && config.authFreeEndpoints.includes(path)
}

const getUserByUid = async (uid) => {
	const userRef = getUserRef(uid)
	const snapshot = await userRef.once('value')
	return snapshot.val()
}

const requireAuth = async (req, res, next) => {
	try {
		const idToken = req.cookies.token
		if (!idToken) {
			if (isAuthFree(req.path)) return next()
			return res.status(401).redirect('/login')
		}
		const user = await verifyIdToken(idToken, true) // Pass true to check if token is revoked
		const userData = await getUserByUid(user.uid)
		req.user = { ...user, ...userData }

		if (req.path === '/login') return res.redirect('/')

		next()
	} catch (err) {
		console.error('Authentication error:', err.message)
		if (isAuthFree(req.path)) return next()
		return res.status(401).json({ message: 'Unauthorized: Invalid token' })
	}
}
export default requireAuth
