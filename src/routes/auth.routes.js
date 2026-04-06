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

const loginRateLimit = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 10,
	standardHeaders: true,
	legacyHeaders: false,
	message: { message: 'Too many login attempts. Please try again later.' }
})

const logoutRateLimit = rateLimit({
	windowMs: 60 * 1000,
	max: 20,
	standardHeaders: true,
	legacyHeaders: false,
	message: { message: 'Too many logout attempts. Please try again later.' }
})

router.get('/login', getLoginPage)
router.post('/login', loginRateLimit, loginController)
router.get('/profile', getProfilePage)
router.post('/logout', logoutRateLimit, logoutController)
router.get('/api/firebase-config', (req, res) => {
	res.json(config.firebase.web)
})

export default router
