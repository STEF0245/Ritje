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

export { app, auth }

export default app
