import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js'
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js'

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

if (!hasValidConfig) {
	if (statusNode) {
		statusNode.textContent =
			'Authenticatieconfiguratie ontbreekt. Neem contact op met de beheerder.'
	}
	throw new Error('Missing Firebase web configuration for login flow.')
}

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)

const setStatus = (message) => {
	if (statusNode) {
		statusNode.textContent = message
	}
}

form.addEventListener('submit', async (event) => {
	event.preventDefault()
	setStatus('Bezig met inloggen...')

	const submitButton = form.querySelector('button[type="submit"]')
	if (submitButton) {
		submitButton.disabled = true
	}

	try {
		const email = emailInput.value.trim()
		const password = passwordInput.value
		const credentials = await auth.signInWithEmailAndPassword(
			email,
			password
		)
		const idToken = await credentials.user.getIdToken(true)

		idTokenInput.value = idToken

		// Clear the in-memory Firebase session; server session cookie becomes source of truth.
		await auth.signOut()

		form.submit()
	} catch (error) {
		console.error('Login error:', error)
		setStatus('Inloggen is mislukt. Controleer je e-mail en wachtwoord.')
		if (submitButton) {
			submitButton.disabled = false
		}
	}
})
