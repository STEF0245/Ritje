import express from 'express'

const router = express.Router()

router.get('/login', (req, res) => {
	res.render('auth_login', { title: 'Inloggen' })
})

router.get('/register', (req, res) => {
	res.render('auth_register', { title: 'Registreren' })
})

export default router
