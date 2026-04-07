/**
 * @file Client-side Firebase login exchange helper.
 * @brief Handles the login form submission and token retrieval.
 * @details This script initializes the Firebase app with configuration fetched from the server, listens for the login form submission, and uses Firebase Authentication to sign in the user with email and password. Upon successful login, it retrieves the ID token and submits it to the server for session cookie creation. It also provides user feedback on the login status.
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js'
import {
	getAuth,
	signInWithEmailAndPassword,
	signOut
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js'

const form = document.getElementById('login-form')
const statusNode = document.getElementById('login-status')
const emailInput = document.getElementById('email')
const passwordInput = document.getElementById('password')
const idTokenInput = document.getElementById('idToken')

const requiredConfigKeys = ['apiKey', 'authDomain', 'projectId', 'appId']
// Fetch config from server instead of window
const response = await fetch('/api/firebase-config')
const firebaseConfig = await response.json()
const hasValidConfig = requiredConfigKeys.every((key) =>
	Boolean(firebaseConfig[key])
)

if (!form || !emailInput || !passwordInput || !idTokenInput) {
	throw new Error('Login formulier is niet correct geladen.')
}

/**
 * @brief Update the login status message.
 * @details Sets message text and color tone classes based on the provided status type.
 * @param {string} message - Status message to display.
 * @param {'info'|'danger'} type - Status tone.
 * @returns {void}
 */
const setStatus = (message, type) => {
	if (statusNode) {
		statusNode.textContent = message
		statusNode.className = `mt-4 text-sm font-medium ${type === 'info' ? 'text-blue-500' : ''} ${type === 'danger' ? 'text-red-500' : ''}`
	}
}

if (!hasValidConfig) {
	if (statusNode) {
		setStatus(
			'Authenticatieconfiguratie ontbreekt. Neem contact op met de beheerder.',
			'danger'
		)
	}
	throw new Error('Missing Firebase web configuration for login flow.')
}

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)

form.addEventListener('submit', async (event) => {
	event.preventDefault()
	setStatus('Bezig met inloggen...', 'info')

	const submitButton = form.querySelector('button[type="submit"]')
	if (submitButton) {
		submitButton.disabled = true
	}

	try {
		const email = emailInput.value.trim()
		const password = passwordInput.value
		const credentials = await signInWithEmailAndPassword(
			auth,
			email,
			password
		)
		const idToken = await credentials.user.getIdToken(true)

		idTokenInput.value = idToken

		// Clear the in-memory Firebase session; server session cookie becomes source of truth.
		await signOut(auth)

		form.submit()
	} catch (error) {
		console.error('Login error:', error)
		setStatus(
			'Inloggen is mislukt. Controleer je e-mail en wachtwoord.',
			'danger'
		)
		if (submitButton) {
			submitButton.disabled = false
		}
	}
})
