import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js'
import {
	getAuth,
	onAuthStateChanged,
	setPersistence,
	browserLocalPersistence
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js'

const requiredConfigKeys = ['apiKey', 'authDomain', 'projectId', 'appId']
// Fetch config from server instead of window
const response = await fetch('/api/firebase-config')
const firebaseConfig = await response.json()
const hasValidConfig = requiredConfigKeys.every((key) =>
	Boolean(firebaseConfig[key])
)

if (!hasValidConfig) {
	throw new Error('Missing Firebase web configuration for login flow.')
}

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)

// Enable persistence so auth state is maintained across page reloads
await setPersistence(auth, browserLocalPersistence)

/**
 * Store the user's ID token for API calls when needed.
 * This is fetched from the server since it's in an HTTP-only cookie.
 */
let userIdToken = null

/**
 * Fetch the user's ID token from the server.
 * @returns {Promise<string>} The user's Firebase ID token.
 */
export const getIdToken = async () => {
	if (userIdToken) {
		return userIdToken
	}

	try {
		const res = await fetch('/api/id-token')
		if (res.ok) {
			const { idToken } = await res.json()
			userIdToken = idToken
			return idToken
		}
	} catch (error) {
		console.error('[Firebase] Error fetching ID token:', error)
	}

	return null
}

/**
 * Promise that resolves when auth state has finished initializing.
 * Use this when you need to ensure auth.currentUser is accurate.
 */
export const authReady = new Promise((resolve) => {
	const unsubscribe = onAuthStateChanged(auth, (user) => {
		// Auth state has been checked
		if (user) {
			// Cache the token for later use
			user.getIdToken()
				.then((token) => {
					userIdToken = token
					console.log('[Firebase] Cached ID token from user')
				})
				.catch((err) => {
					console.warn(
						'[Firebase] Could not cache ID token:',
						err.message
					)
				})
		}

		unsubscribe()
		resolve(user)
	})
})

export { app, auth }

export default app
