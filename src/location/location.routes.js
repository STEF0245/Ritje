/**
 * @file Location routes for reverse geocoding endpoints.
 * @brief  Applies provider-specific rate limits to the API route.
 * @details  Stacks provider-aware rate limit middleware and forwards eligible requests to the reverse geocoding controller.
 */

import express from 'express'
import rateLimit from 'express-rate-limit'
import {
	forwardGeocodeController,
	reverseGeocodeController
} from '../location/location.controller.js'
import { RATE_LIMIT_CONFIG, getProvider } from '../location/location.service.js'
import config from '../config.js'

const router = express.Router()

/**
 * @brief  Build a rate limiter that only applies to one provider.
 * @details  Uses the active provider resolver to skip limiter evaluation when another provider is selected.
 * @param {string} providerName - Provider name this limiter should target.
 * @param {{windowMs: number, max: number}} config - Rate limit configuration.
 * @returns {Function} Express middleware from `express-rate-limit`.
 */
const buildProviderLimiter = (providerName, config) =>
	rateLimit({
		windowMs: config.windowMs,
		max: config.max,
		standardHeaders: true,
		legacyHeaders: false,
		skip: () => getProvider() !== providerName,
		message: {
			error: `Too many geocode requests for ${providerName}`,
			provider: providerName,
			status: 429
		}
	})

const geoapifyLimiter = buildProviderLimiter(
	'geoapify',
	RATE_LIMIT_CONFIG.geoapify
)

router.post('/forward-geocode', geoapifyLimiter, forwardGeocodeController)
router.post('/reverse-geocode', geoapifyLimiter, reverseGeocodeController)
router.get('/school-location', (req, res) => {
	res.json(config.school)
})

export default router
