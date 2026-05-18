/**
 * @file Firebase app initialization and authentication setup (client-side).
 * @brief Configures Firebase Auth with local persistence and token refresh.
 * @details Fetches Firebase web configuration from `/api/firebase-config`, initializes the Firebase app, enables browser local persistence for auth state, and initiates automatic token refresh. Exports `authReady` promise to ensure auth state is ready before use.
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js'
import {
	getAuth,
	onAuthStateChanged,
	setPersistence,
	browserLocalPersistence
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js'
import { initTokenRefresh } from './token-refresh.js'

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
 * Promise that resolves when auth state has finished initializing.
 * Use this when you need to ensure auth.currentUser is accurate.
 */
export const authReady = new Promise((resolve) => {
	const unsubscribe = onAuthStateChanged(auth, (user) => {
		// Auth state has been checked
		unsubscribe()
		resolve(user)
	})
})

// Initialize automatic token refresh once auth is ready
initTokenRefresh().catch((err) => {
	console.error('Failed to initialize token refresh:', err.message)
})

export { app, auth }

export default app
