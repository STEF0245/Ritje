/**
 * @file Client-side email verification resend handler.
 * Requests the server to resend the verification email.
 */

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
			const response = await fetch(
				'/api/auth/resend-verification-email',
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					}
				}
			)

			if (!response.ok) {
				const error = await response.json().catch(() => null)
				throw new Error(
					error?.message || 'Failed to send verification email'
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
