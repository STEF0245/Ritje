import express from 'express'
import {
	getProfilePage,
	getProfileEditPage,
	postProfileEditPage
} from './page.controller.js'
import { requireAuth } from '../auth/auth.middleware.js'

const router = express.Router()

// Home page
router.get('/', (req, res) => {
	res.render('home', { title: 'Welkom bij Ritje!' })
})

router.get('/profile', requireAuth, getProfilePage)
router.get('/profile/edit', requireAuth, getProfileEditPage)
router.post('/profile/edit', requireAuth, postProfileEditPage)

export default router
