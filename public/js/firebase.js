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

const initialSession = window.__RITJE_SESSION__ || { idToken: null, user: null }

/**
 * Store session data for API calls and client-side user context.
 * This is fetched from the server because the token lives in an HTTP-only cookie.
 */
let userIdToken = initialSession.idToken || null
let currentSessionUser = initialSession.user || null

/**
 * Fetch and cache the authenticated session payload.
 * @returns {Promise<{ idToken: string|null, user: object|null }>} Session payload.
 */
export const getSessionData = async () => {
	return {
		idToken: userIdToken,
		user: currentSessionUser
	}
}

/**
 * Fetch the user's ID token from the server.
 * @returns {Promise<string>} The user's Firebase ID token.
 */
export const getIdToken = async () => {
	const { idToken } = await getSessionData()
	return idToken
}

/**
 * Fetch the authenticated user from the same session payload as the token.
 * @returns {Promise<object|null>} Normalized authenticated user object.
 */
export const getCurrentUser = async () => {
	const { user } = await getSessionData()
	return user
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
