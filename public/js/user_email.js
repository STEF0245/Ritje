/**
 * @file Client-side email verification resend handler.
 * @brief  Wires the profile email verification UI to the resend endpoint.
 * @details  Makes the verification indicator clickable when the email is unverified and posts a resend request to the server.
 */

/**
 * @brief  Set up the email verification resend interaction.
 * @details  Attaches a click handler to the verification indicator when it is interactive and submits the resend form on demand.
 * @returns {Promise<void>} Resolves after the UI handler has been registered.
 */
const setupEmailVerificationResend = async () => {
	const verifiedSpan = document.querySelector('#emailVerified')

	if (!verifiedSpan) {
		console.warn('[Email Verification] Email verification span not found')
		return
	}

	if (!verifiedSpan.classList.contains('cursor-pointer')) {
		return
	}

	verifiedSpan.addEventListener('click', async () => {
		verifiedSpan.style.opacity = '0.5'
		verifiedSpan.style.pointerEvents = 'none'

		const form = document.createElement('form')
		form.method = 'POST'
		form.action = '/api/auth/resend-verification-email'
		form.style.display = 'none'
		document.body.appendChild(form)
		form.submit()
	})
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', setupEmailVerificationResend)
} else {
	setupEmailVerificationResend()
}
