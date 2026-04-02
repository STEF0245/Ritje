import { getAuth } from 'firebase-admin/auth'
import app from './app.js'

export const auth = getAuth(app)

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
