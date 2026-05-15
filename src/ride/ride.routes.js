/**
 * @file Ride routes for the main ride page.
 * @brief Defines the route for the ride page and applies any necessary middleware.
 * @details Sets up the GET endpoint for the ride page and includes rate limiting to prevent abuse of the ride page access.
 */

import express from 'express'
import {
	redirectToRidePage,
	getRidePage,
	cancelRideAction,
	respondToRideAction,
	calculateRouteWithSuggestions,
	saveRideRoute
} from './ride.controller.js'

const router = express.Router()

// Simple in-memory rate limiter for the calculate endpoint.
// This prevents abusive bursts (e.g. 100 requests/sec) from a single user/IP.
const calculateLimiter = (() => {
	const hits = new Map()
	const WINDOW_MS = Number(
		process.env.CALCULATE_RATE_LIMIT_WINDOW_MS || 10000
	) // 10s
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
router.post('/:day/:hour/cancel', cancelRideAction)
router.post('/:day/:hour/respond', respondToRideAction)
router.post('/calculate', calculateLimiter, calculateRouteWithSuggestions)
router.post('/save', saveRideRoute)

export default router
