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
