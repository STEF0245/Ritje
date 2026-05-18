/**
 * @file Ride routes for the main ride page.
 * @brief Defines the route for the ride page and applies any necessary middleware.
 * @details Sets up the GET endpoint for the ride page and includes rate limiting to prevent abuse of the ride page access.
 */

import express from 'express'
import {
	redirectToRidePage,
	getRidePage,
	getRideEditPage,
	cancelRideAction,
	respondToRideAction,
	calculateRouteWithSuggestions,
	saveRideRoute
} from './ride.controller.js'

const router = express.Router()

/**
 * @brief  Create the in-memory rate limiter used by the route calculation endpoint.
 * @details  Tracks requests per user or IP in a rolling time window so the calculate action cannot be spammed in bursts.
 * @returns {Function} Express middleware that rate-limits calculate requests.
 */
const calculateLimiter = (() => {
	const hits = new Map()
	const WINDOW_MS = Number(
		process.env.CALCULATE_RATE_LIMIT_WINDOW_MS || 10000
	)
	const MAX = Number(process.env.CALCULATE_RATE_LIMIT_MAX || 5)

	return (req, res, next) => {
		const key = req.user?.uid || req.ip
		if (!key) {
			res.status(400).json({
				error: 'Unable to identify user or IP for rate limiting.'
			})
			return
		}
		const now = Date.now()
		const entry = hits.get(key) || { count: 0, windowStart: now }

		if (now - entry.windowStart > WINDOW_MS) {
			entry.count = 0
			entry.windowStart = now
		}

		entry.count += 1
		hits.set(key, entry)

		if (entry.count > MAX) {
			res.status(429).json({
				error: 'Te veel verzoeken. Probeer het later opnieuw.'
			})
			return
		}

		next()
	}
})()

router.get('/', redirectToRidePage)
router.get('/:day/:hour', getRidePage)
router.get('/:day/:hour/edit', getRideEditPage)
router.post('/:day/:hour/cancel', cancelRideAction)
router.post('/:day/:hour/respond', respondToRideAction)
router.post('/calculate', calculateLimiter, calculateRouteWithSuggestions)
router.post('/save', saveRideRoute)

export default router
