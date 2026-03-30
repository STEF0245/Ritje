import { getAuth } from 'firebase-admin/auth'
import app from './app.js'

export const auth = getAuth(app)

export const verifyIdToken = async (idToken, checkRevoked = true) => {
	try {
		return await auth.verifyIdToken(idToken, checkRevoked)
	} catch (error) {
		console.error('Firebase token verification failed:', error.message)
		throw error
	}
}

export default auth
