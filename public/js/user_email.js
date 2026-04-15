/**
 * @file Client-side email verification resend handler.
 * Uses Firebase REST API to send verification email.
 */

import { getSessionData } from './firebase.js'

const setupEmailVerificationResend = async () => {
	const verifiedSpan = document.querySelector('#emailVerified')

	if (!verifiedSpan) {
		console.warn('[Email Verification] Email verification span not found')
		return
	}

	// Only allow clicking if email is not verified (has cursor-pointer class)
	if (!verifiedSpan.classList.contains('cursor-pointer')) {
		console.log(
			'[Email Verification] Email is already verified, skipping setup'
		)
		return
	}

	verifiedSpan.addEventListener('click', async () => {
		console.log('[Email Verification] Click triggered')
		verifiedSpan.style.opacity = '0.5'
		verifiedSpan.style.pointerEvents = 'none'

		try {
			const { user, idToken } = await getSessionData()
			if (!user?.uid) {
				console.error(
					'[Email Verification] Could not resolve authenticated user'
				)
				alert('Niet geverifieerd. Log in en probeer het opnieuw.')
				throw new Error('No authenticated user')
			}

			if (!idToken) {
				console.error('[Email Verification] Could not get ID token')
				alert('Niet geverifieerd. Log in en probeer het opnieuw.')
				throw new Error('No ID token')
			}

			console.log(
				'[Email Verification] Got ID token, calling Firebase REST API'
			)

			// Call Firebase REST API to send verification email
			// Get Firebase API key from config
			const configRes = await fetch('/api/firebase-config')
			const config = await configRes.json()
			const apiKey = config.apiKey

			const response = await fetch(
				`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						requestType: 'VERIFY_EMAIL',
						idToken: idToken
					})
				}
			)

			if (!response.ok) {
				const error = await response.json()
				throw new Error(
					error.error?.message || 'Failed to send verification email'
				)
			}

			console.log(
				'[Email Verification] Verification email sent successfully'
			)
			alert(
				'Verificatie-e-mail is opnieuw verzonden. Controleer je inbox.'
			)
		} catch (error) {
			console.error('[Email Verification] Error:', error.message)
			alert(
				'Er is een fout opgetreden bij het verzenden van de verificatie-e-mail. Probeer het later opnieuw.'
			)
		} finally {
			verifiedSpan.style.opacity = '1'
			verifiedSpan.style.pointerEvents = 'auto'
		}
	})
}

// Run when DOM is ready
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', setupEmailVerificationResend)
} else {
	setupEmailVerificationResend()
}
