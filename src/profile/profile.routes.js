/**
 * @file Profile routes for the authenticated user's account pages.
 * @brief Mounts profile overview and edit endpoints with rate limiting.
 * @details Defines GET and POST profile endpoints and applies request throttling to profile update submissions.
 */

import express from 'express'
import rateLimit from 'express-rate-limit'
import {
	getProfilePage,
	getProfileEditPage,
	profileEditController
} from './profile.controller.js'

const router = express.Router()

const profileRateLimit = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 20,
	standardHeaders: true,
	legacyHeaders: false,
	message: {
		message: 'Too many profile update attempts. Please try again later.'
	}
})

router.get('/profile', getProfilePage)
router.get('/profile/edit', getProfileEditPage)
router.post('/profile/edit', profileRateLimit, profileEditController)

export default router
