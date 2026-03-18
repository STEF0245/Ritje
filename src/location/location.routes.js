import express from 'express'
import rateLimit from 'express-rate-limit'
import { reverseGeocodeController } from './location.controller.js'
import { RATE_LIMIT_CONFIG, getProvider } from './location.service.js'

const router = express.Router()

const buildProviderLimiter = (providerName, config) =>
	rateLimit({
		windowMs: config.windowMs,
		max: config.max,
		standardHeaders: true,
		legacyHeaders: false,
		skip: () => getProvider() !== providerName,
		message: {
			error: `Too many reverse-geocode requests for ${providerName}`,
			provider: providerName
		}
	})

const nominatimLimiter = buildProviderLimiter(
	'nominatim',
	RATE_LIMIT_CONFIG.nominatim
)
const locationIqLimiter = buildProviderLimiter(
	'locationiq',
	RATE_LIMIT_CONFIG.locationiq
)
const geoapifyLimiter = buildProviderLimiter(
	'geoapify',
	RATE_LIMIT_CONFIG.geoapify
)

router.post(
	'/reverse-geocode',
	nominatimLimiter,
	locationIqLimiter,
	geoapifyLimiter,
	reverseGeocodeController
)

export default router
