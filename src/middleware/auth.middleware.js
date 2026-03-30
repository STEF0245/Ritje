import { verifyIdToken, auth } from '../firebase/auth.js'
import { getUserRef } from '../firebase/db.js'
import config from '../config.js'

const isPathAuthFree = (path) => {
	return config.authFreeEndpoints && config.authFreeEndpoints.includes(path)
}

const getUserRefByUid = async (uid) => {
	const userRef = getUserRef(uid)
	const snapshot = await userRef.once('value')
	return snapshot.val()
}

const mapUserData = (firebaseUser, dbUser) => {
	return {
		uid: firebaseUser?.uid,
		email: firebaseUser?.email || dbUser?.email || '',
		phoneNumber: firebaseUser?.phoneNumber || dbUser?.phoneNumber || '',
		displayName: dbUser?.name?.full || firebaseUser?.displayName || '',
		photoURL: firebaseUser?.photoURL || dbUser?.photoURL || '',
		emailVerified:
			dbUser?.emailVerified || firebaseUser?.emailVerified || false,
		createdAt:
			firebaseUser?.metadata?.creationTime || dbUser?.createdAt || '',
		lastSignInTime:
			firebaseUser?.metadata?.lastSignInTime ||
			dbUser?.lastSignInTime ||
			'',
		disabled: firebaseUser?.disabled || false,
		metadata: dbUser || {}
	}
}

const requireAuth = async (req, res, next) => {
	try {
		const idToken = req.cookies.token
		if (!idToken) {
			if (isPathAuthFree(req.path)) return next()
			return res.status(401).redirect('/login')
		}
		const decodedToken = await verifyIdToken(idToken, true) // Pass true to check if token is revoked
		const user = await auth.getUser(decodedToken.uid) // Fetch user details to check if account is disabled
		if (user.disabled)
			return res.status(403).json({ message: 'Account is disabled' })
		const userData = await getUserRefByUid(user.uid)
		req.user = mapUserData(user, userData)

		if (req.path === '/login') return res.redirect('/')
		next()
	} catch (err) {
		console.error('Authentication error:', err.message)
		if (isPathAuthFree(req.path)) return next()
		return res.status(401).redirect('/login')
	}
}

export default requireAuth
