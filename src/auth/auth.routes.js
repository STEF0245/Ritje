import express from 'express'

const router = express.Router()
const AUTH_ERROR_COOKIE = 'auth-error-reason'

router.get('/login', (req, res) => {
	const authErrorReason = req.cookies[AUTH_ERROR_COOKIE] || null
	if (authErrorReason) {
		res.clearCookie(AUTH_ERROR_COOKIE)
	}

	res.render('auth_login', {
		title: 'Inloggen',
		authErrorReason
	})
})

router.get('/register', (req, res) => {
	res.render('auth_register', { title: 'Registreren' })
})

export default router
