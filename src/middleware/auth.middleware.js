import { verifyIdToken, auth } from '../firebase/auth.js'
import db from '../firebase/db.js'
import config from '../config.js'

const isPathAuthFree = (path) => {
	return config.authFreeEndpoints && config.authFreeEndpoints.includes(path)
}

const getUserData = async (uid) => {
	const userRef = db.ref(`users/${uid}`)
	const snapshot = await userRef.once('value')
	return snapshot.val() || {}
}

const isAdmin = async (uid) => {
	const permsRef = db.ref(`admins/${uid}`)
	const snapshot = await permsRef.once('value')
	return snapshot.val() === true
}

const mapUserData = (firebaseUser, dbUser, admin) => {
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
		metadata: dbUser || {},
		admin: admin || false
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
		const userData = await getUserData(user.uid)
		const admin = await isAdmin(user.uid)

		req.user = mapUserData(user, userData, admin)

		if (req.path === '/login') return res.redirect('/')
		next()
	} catch (err) {
		console.error('Authentication error:', err.message)
		if (isPathAuthFree(req.path)) return next()
		return res.status(401).redirect('/login')
	}
}

export default requireAuth
