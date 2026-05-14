/**
 * @file Authentication routes for login, logout, and Firebase config access.
 * @brief  Mounts auth endpoints with rate limiting where appropriate.
 * @details  Configures login and logout throttling and exposes the Firebase web config endpoint required by the browser login module.
 */

import express from 'express'
import { rateLimit, ipKeyGenerator } from 'express-rate-limit'
import config from '../config.js'
import {
	getLoginPage,
	loginController,
	logoutController,
	resendVerificationEmailController,
	refreshTokenController
} from './auth.controller.js'
import { respondWithNotification } from '../utils/notification.util.js'

const router = express.Router()

const keyGenerator = (req) => {
	return req.user?.uid || ipKeyGenerator(req.ip)
}

const loginRateLimit = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 10,
	keyGenerator,
	standardHeaders: true,
	legacyHeaders: false,
	message: { message: 'Too many login attempts. Please try again later.' }
})

const logoutRateLimit = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 20,
	keyGenerator,
	standardHeaders: true,
	legacyHeaders: false,
	message: { message: 'Too many logout attempts. Please try again later.' }
})

const resendVerificationRateLimit = rateLimit({
	windowMs: 5 * 60 * 1000,
	max: 1,
	keyGenerator,
	standardHeaders: true,
	legacyHeaders: false,
	message: {
		message: 'Too many verification email attempts. Please try again later.'
	},
	handler: (req, res, next, options) => {
		return respondWithNotification(res, {
			type: 'error',
			message:
				'Te veel verzoeken om de verificatie-e-mail opnieuw te verzenden. Probeer het later opnieuw.',
			redirectTo: '/profile'
		})
	}
})

router.get('/login', getLoginPage)
router.post('/login', loginRateLimit, loginController)
router.post('/logout', logoutRateLimit, logoutController)
router.post(
	'/api/auth/resend-verification-email',
	resendVerificationRateLimit,
	resendVerificationEmailController
)
router.post('/api/auth/refresh-token', refreshTokenController)
router.get('/api/firebase-config', (req, res) => {
	res.json(config.firebase.web)
})

export default router
