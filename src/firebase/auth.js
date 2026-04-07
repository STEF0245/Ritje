import { getAuth } from 'firebase-admin/auth'
import app from './app.js'

export const auth = getAuth(app)

export const generateRandomUid = () => {
	const chars =
		'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
	let uid = ''
	for (let i = 0; i < 8; i++) {
		uid += chars.charAt(Math.floor(Math.random() * chars.length))
	}
	return uid
}

export const verifyIdToken = async (idToken, checkRevoked = true) => {
	try {
		return await auth.verifyIdToken(idToken, checkRevoked)
	} catch (error) {
		if (error.code === 'auth/id-token-expired') {
			console.warn('Firebase token has expired:', error.message)
		} else if (error.code === 'auth/id-token-revoked') {
			console.warn('Firebase token has been revoked:', error.message)
		} else {
			console.error('Error verifying Firebase token:', error.message)
		}
		throw error
	}
}

export default auth
