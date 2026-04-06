import express from 'express'
import rateLimit from 'express-rate-limit'
import config from '../config.js'
import {
	getLoginPage,
	loginController,
	getProfilePage,
	logoutController
} from '../controllers/auth.controller.js'

const router = express.Router()

const ratelimit = rateLimit()

router.get('/login', getLoginPage)
router.post('/login', ratelimit, loginController)
router.get('/profile', getProfilePage)
router.get('/logout', ratelimit, logoutController)
router.post('/logout', ratelimit, logoutController)
router.get('/api/firebase-config', (req, res) => {
	res.json(config.firebase.web)
})

export default router
