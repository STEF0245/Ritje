/**
 * @file Location routes for reverse geocoding endpoints.
 * @brief Applies provider-specific rate limits to the API route.
 */

import express from 'express'
import rateLimit from 'express-rate-limit'
import { reverseGeocodeController } from '../location/location.controller.js'
import { RATE_LIMIT_CONFIG, getProvider } from '../location/location.service.js'

const router = express.Router()

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

const nominatimLimiter = buildProviderLimiter(
	'nominatim',
	RATE_LIMIT_CONFIG.nominatim
)
const geoapifyLimiter = buildProviderLimiter(
	'geoapify',
	RATE_LIMIT_CONFIG.geoapify
)

router.post(
	'/reverse-geocode',
	nominatimLimiter,
	geoapifyLimiter,
	reverseGeocodeController
)

export default router
