import express from 'express'
import { requireAuth } from '../auth/auth.middleware.js'

const router = express.Router()

// Home page
router.get('/', (req, res) => {
	res.render('home', { title: 'Welkom bij Ritje!' })
})

router.get('/profile', requireAuth, (req, res) => {
	res.render('profile', {
		title: 'Mijn Profiel'
	})
})

export default router
