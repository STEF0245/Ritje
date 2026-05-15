/**
 * @file Route caching and calculation services.
 * @brief Manages route calculations with TTL-based caching to reduce API calls.
 */

import { calculateRoute } from '../location/location.service.js'

const ROUTE_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
const routeCache = new Map()

/**
 * @brief Clears expired entries from the route cache.
 * @details Called periodically to prevent unbounded memory growth.
 */
export const cleanupRouteCache = () => {
	const now = Date.now()
	for (const [key, entry] of routeCache.entries()) {
		if (entry.expiresAt <= now) {
			routeCache.delete(key)
		}
	}
}

/**
 * @brief Retrieves the base route from origin to destination with caching.
 * @param {{latitude: number, longitude: number}} originCoords - Starting point.
 * @param {{latitude: number, longitude: number}} destinationCoords - Ending point.
 * @returns {Promise<object|null>} - Cached or freshly calculated route.
 */
export const getBaseRoute = async (originCoords, destinationCoords) => {
	if (!originCoords || !destinationCoords) {
		return null
	}

	const cacheKey = `${originCoords.latitude.toFixed(5)},${originCoords.longitude.toFixed(5)}`
	const cachedRoute = routeCache.get(cacheKey)

	if (cachedRoute && cachedRoute.expiresAt > Date.now()) {
		return cachedRoute.value
	}

	try {
		const route = await calculateRoute(originCoords, destinationCoords)
		routeCache.set(cacheKey, {
			value: route,
			expiresAt: Date.now() + ROUTE_CACHE_TTL_MS
		})
		return route
	} catch (error) {
		console.error('Error calculating base route:', error)
		return null
	}
}

/**
 * @brief Calculates route through waypoints with optional caching.
 * @param {{latitude: number, longitude: number}} origin - Starting point.
 * @param {{latitude: number, longitude: number}} destination - Ending point.
 * @param {Array<{latitude: number, longitude: number}>} waypoints - Pickup locations.
 * @param {string} cacheKey - Optional cache key for storing result.
 * @returns {Promise<object|null>} - Calculated route or null on error.
 */
export const calculateRouteWithWaypoints = async (
	origin,
	destination,
	waypoints,
	cacheKey = null
) => {
	if (!origin || !destination) {
		return null
	}

	// Check cache if key provided
	if (cacheKey) {
		const cached = routeCache.get(cacheKey)
		if (cached && cached.expiresAt > Date.now()) {
			return cached.value
		}
	}

	try {
		const route = await calculateRoute(origin, destination, waypoints)

		// Cache result if key provided
		if (cacheKey) {
			routeCache.set(cacheKey, {
				value: route,
				expiresAt: Date.now() + ROUTE_CACHE_TTL_MS
			})
		}

		return route
	} catch (error) {
		console.error('Error calculating route with waypoints:', error)
		return null
	}
}

/**
 * @brief Generates a cache key from origin and suggestion UIDs.
 * @param {{latitude: number, longitude: number}} origin - Starting point.
 * @param {string[]} suggestionUids - Selected passenger UIDs.
 * @returns {string} - Cache key for the route.
 */
export const buildRouteCacheKey = (origin, suggestionUids = []) => {
	const originKey = `${origin.latitude.toFixed(5)},${origin.longitude.toFixed(5)}`
	const idsKey = suggestionUids.map(String).filter(Boolean).sort().join(',')
	return `route:${originKey}:ids:${idsKey || 'none'}`
}
