import auth from '../firebase/auth.js'

const authService = {
	verifyToken: async (idToken) => {
		try {
			const decodedToken = await auth.verifyIdToken(idToken, true)
			return decodedToken
		} catch (error) {
			console.error('Firebase token verification failed:', error)
			throw error
		}
	}
}

export default authService
