/**
 * @file Ride controller for handling ride page requests.
 * @brief Provides the handlers for rendering the ride page and fetching ride suggestions.
 * @details The page handler renders the initial ride view, and the JSON handler returns refreshed suggestions for a selected schedule slot.
 */

import db from '../firebase/db.js'
import config from '../config.js'
import { respondWithNotification } from '../utils/notification.util.js'
import {
	calculateRoute,
	findMarkersOnRoute
} from '../location/location.service.js'

import { getDistanceFromLatLonInKm } from '../location/location.service.js'

const toNonNegativeInteger = (value) => {
	const parsed = Number(value)
	if (!Number.isFinite(parsed)) return null
	if (!Number.isInteger(parsed) || parsed < 0) return null
	return parsed
}

const normalizeSuggestionIds = (value) => {
	if (!Array.isArray(value)) return []

	return value.map((id) => String(id)).filter(Boolean)
}

/**
 * @brief Order waypoints with a simple greedy nearest-neighbor heuristic.
 * @param {{latitude:number,longitude:number}} origin
 * @param {Array<{latitude:number,longitude:number}>} waypoints
 * @returns {Array<object>} ordered waypoints
 */
const optimizeWaypointOrder = (origin, waypoints = []) => {
	if (!origin || !Array.isArray(waypoints) || waypoints.length <= 1)
		return waypoints

	const remaining = waypoints.slice()
	const ordered = []
	let current = { latitude: origin.latitude, longitude: origin.longitude }

	while (remaining.length > 0) {
		let bestIndex = 0
		let bestDist = Number.POSITIVE_INFINITY
		for (let i = 0; i < remaining.length; i++) {
			const w = remaining[i]
			const d = getDistanceFromLatLonInKm(
				current.latitude,
				current.longitude,
				w.latitude,
				w.longitude
			)
			if (d < bestDist) {
				bestDist = d
				bestIndex = i
			}
		}
		const next = remaining.splice(bestIndex, 1)[0]
		ordered.push(next)
		current = { latitude: next.latitude, longitude: next.longitude }
	}

	return ordered
}

const getNestedValue = (source, path = []) => {
	return path.reduce((current, key) => current?.[key], source)
}

const normalizeCoordinates = (point) => {
	const latitude = Number(point?.latitude ?? point?.lat)
	const longitude = Number(point?.longitude ?? point?.lon)

	if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
		return null
	}

	return { latitude, longitude }
}

const SCHOOL_DESTINATION = normalizeCoordinates(config.school?.coords)

/**
 * @brief Keeps recently loaded users and routes in memory to avoid repeated database and routing calls.
 * @details The user cache is short-lived because location data changes more often than route geometry.
 * @details Route results are cached per origin for a short period so repeated ride requests can reuse the same routing response.
 */
const USERS_CACHE_TTL_MS = 30 * 1000
const ROUTE_CACHE_TTL_MS = 5 * 60 * 1000

let cachedUsers = {
	value: null,
	expiresAt: 0
}

const routeCache = new Map()

// routeCache stores entries like { value, expiresAt }

const getRideSettings = (preferences = {}) => {
	return {
		seats: {
			total:
				toNonNegativeInteger(
					getNestedValue(preferences, ['seats', 'total'])
				) || 1
		},
		detour: {
			distance: toNonNegativeInteger(
				getNestedValue(preferences, ['detour', 'distance'])
			),
			duration: toNonNegativeInteger(
				getNestedValue(preferences, ['detour', 'duration'])
			)
		}
	}
}

/**
 * @brief Checks if the given point has valid latitude and longitude coordinates.
 * @param {latitude: number|string, longitude: number|string} point - The point to validate.
 * @returns {boolean} - True if the point has valid coordinates, false otherwise.
 * @details This is used before any marker or coordinate is included in map or suggestion calculations.
 */
const hasValidCoordinates = (point) => {
	const latitude = Number(point?.latitude)
	const longitude = Number(point?.longitude)
	return Number.isFinite(latitude) && Number.isFinite(longitude)
}

/**
 * @brief Calculates the distance in kilometers between two geographic coordinates using the Haversine formula.
 * @param {latitude: number, longitude: number} start - The starting coordinates.
 * @param {latitude: number, longitude: number} end - The ending coordinates.
 * @returns {number} - The distance in kilometers between the two points, or Infinity if the coordinates are invalid.
 * @details The controller uses this as a fallback distance model when it needs a fast local estimate instead of a routing API result.
 */
const getDistanceInKm = (start, end) => {
	const toRadians = (degrees) => degrees * (Math.PI / 180)
	const earthRadiusKm = 6371

	const startLatitude = Number(start?.latitude)
	const startLongitude = Number(start?.longitude)
	const endLatitude = Number(end?.latitude)
	const endLongitude = Number(end?.longitude)

	if (
		!Number.isFinite(startLatitude) ||
		!Number.isFinite(startLongitude) ||
		!Number.isFinite(endLatitude) ||
		!Number.isFinite(endLongitude)
	) {
		return Number.POSITIVE_INFINITY
	}

	const deltaLatitude = toRadians(endLatitude - startLatitude)
	const deltaLongitude = toRadians(endLongitude - startLongitude)

	const a =
		Math.sin(deltaLatitude / 2) ** 2 +
		Math.cos(toRadians(startLatitude)) *
			Math.cos(toRadians(endLatitude)) *
			Math.sin(deltaLongitude / 2) ** 2
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

	return earthRadiusKm * c
}

/**
 * @brief Estimates the travel time in minutes based on distance and reference metrics.
 * @param {number} distanceKm - The distance in kilometers.
 * @param {{distanceKm?: number, durationMinutes?: number}|null|undefined} referenceMetrics - The reference metrics for estimation.
 * @returns {number} - The estimated travel time in minutes.
 * @details When route metrics are available, the estimate scales by the observed minutes-per-kilometer ratio; otherwise it falls back to a conservative default.
 */
const estimateMinutesFromDistance = (distanceKm, referenceMetrics = null) => {
	const refDistanceKm = Number(referenceMetrics?.distanceKm)
	const refDurationMinutes = Number(referenceMetrics?.durationMinutes)
	if (refDistanceKm > 0) {
		const minutesPerKm = refDurationMinutes / refDistanceKm
		if (Number.isFinite(minutesPerKm) && minutesPerKm > 0) {
			return distanceKm * minutesPerKm
		}
	}

	return distanceKm * 1.5
}

/**
 * @brief Extracts distance and duration metrics from a route response.
 * @details Supports multiple GeoJSON property shapes so the controller can work with different routing payloads.
 * @param {object} route - Route payload returned by the routing API.
 * @returns {{distanceKm: number, durationMinutes: number}|null} Normalized route metrics or null when unavailable.
 * @details The parser accepts several common GeoJSON property names so small API shape changes do not break suggestion calculations.
 */
const getRouteMetrics = (route) => {
	const feature = route?.features?.[0] || null
	const properties = feature?.properties || route?.properties || route || null
	const distanceMeters = Number(
		properties?.distance ??
			properties?.total_distance ??
			properties?.summary?.distance
	)
	const durationSeconds = Number(
		properties?.time ?? properties?.total_time ?? properties?.summary?.time
	)

	if (!Number.isFinite(distanceMeters) || !Number.isFinite(durationSeconds)) {
		return null
	}

	return {
		distanceKm: distanceMeters / 1000,
		durationMinutes: durationSeconds / 60
	}
}

/**
 * @brief Returns the school route from the current origin, using a short-lived cache to reduce routing API calls.
 * @param {{latitude: number, longitude: number}|null} originCoords - Current starting point.
 * @returns {Promise<object|null>} Cached or freshly calculated route payload.
 * @details The route is cached by rounded origin coordinates so identical page updates can reuse the same response.
 */
const getBaseRoute = async (originCoords) => {
	if (!originCoords || !SCHOOL_DESTINATION) {
		return null
	}

	const cacheKey = `${originCoords.latitude.toFixed(5)},${originCoords.longitude.toFixed(5)}`
	const cachedRoute = routeCache.get(cacheKey)
	if (cachedRoute && cachedRoute.expiresAt > Date.now()) {
		return cachedRoute.value
	}

	try {
		const route = await calculateRoute(originCoords, SCHOOL_DESTINATION)
		routeCache.set(cacheKey, {
			value: route,
			expiresAt: Date.now() + ROUTE_CACHE_TTL_MS
		})
		return route
	} catch (error) {
		console.error('Error calculating ride route:', error)
		return null
	}
}

/**
 * @brief Checks whether a candidate suggestion still fits the user's detour limits.
 * @param {object} marker - Candidate ride marker.
 * @param {{detour?: {distance?: number, duration?: number}}} preferences - User detour preferences.
 * @returns {boolean} True when the marker is within the configured limits.
 * @details A marker is treated as acceptable unless it exceeds one of the configured detour thresholds.
 */
const checkSuggestionWithPreferences = (marker, preferences = {}) => {
	const detourDistance = Number(marker?.detour?.distance)
	const detourDuration = Number(marker?.detour?.duration)
	const limitDistance = Number(preferences?.detour?.distance)
	const limitDuration = Number(preferences?.detour?.duration)

	if (!Number.isFinite(detourDistance) && !Number.isFinite(detourDuration)) {
		return true
	}

	if (Number.isFinite(limitDistance) && detourDistance > limitDistance) {
		return false
	}

	if (Number.isFinite(limitDuration) && detourDuration > limitDuration) {
		return false
	}

	return true
}

/**
 * @brief Adds preference match metadata to each marker.
 * @param {Array<object>} markers - Suggestion markers.
 * @param {object} preferences - User ride preferences.
 * @returns {Array<object>} Markers annotated with a preference match flag.
 * @details The UI can use this flag to sort or visually distinguish suggestions that fit the user's limits.
 */
const annotateSuggestionsWithPreferences = (markers, preferences) => {
	return markers.map((marker) => ({
		...marker,
		matchesPreferences: checkSuggestionWithPreferences(marker, preferences)
	}))
}

/**
 * @brief Loads all user records once and reuses them briefly for repeated ride requests.
 * @returns {Promise<Array<object>>} List of user records.
 * @details The cache keeps ride page requests from repeatedly hitting Firebase when the same data is requested in a short time window.
 */
const getAllUsers = async () => {
	if (cachedUsers.value && cachedUsers.expiresAt > Date.now()) {
		return cachedUsers.value
	}

	try {
		const snapshot = await db.ref('users').once('value')
		const users = snapshot.val()
		const normalizedUsers = users ? Object.values(users) : []
		cachedUsers = {
			value: normalizedUsers,
			expiresAt: Date.now() + USERS_CACHE_TTL_MS
		}
		return normalizedUsers
	} catch (error) {
		console.error('Error fetching user locations:', error)
		return []
	}
}

/**
 * @brief Converts user profiles into map markers with address labels and map links.
 * @param {Array<object>} [users=[]] - User list to convert.
 * @param {string|null} uid - Current user id used to label the home marker.
 * @returns {Array<object>} Normalized marker objects.
 * @details Each marker includes a Google Maps search link so the user can open the address directly from the ride page.
 */
const buildRideMarkers = (users = [], uid) => {
	return users
		.map((user) => {
			const latitude = Number(user?.coords?.latitude)
			const longitude = Number(user?.coords?.longitude)

			if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
				return null
			}

			const street = user?.address?.street || ''
			const houseNumber = user?.address?.houseNumber || ''
			const postalCode = user?.address?.postalCode || ''
			const city = user?.address?.city || ''
			const mapsQuery =
				`${street} ${houseNumber}, ${postalCode} ${city}`.trim()

			return {
				uid: user?.uid || null,
				latitude,
				longitude,
				title:
					uid === user?.uid
						? 'Uw woonplaats'
						: user?.name?.full || 'Onbekende gebruiker',
				lines: [
					`${street} ${houseNumber}`.trim(),
					`${postalCode} ${city}`.trim()
				].filter(Boolean),
				mapsUrl: mapsQuery
					? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`
					: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
			}
		})
		.filter(Boolean)
}

/**
 * @brief Computes the center point for a set of ride markers.
 * @param {Array<{latitude: number, longitude: number}>} [markers=[]] - Marker list.
 * @returns {{latitude: number, longitude: number}|null} Average marker position or null when no valid marker exists.
 * @details The computed center keeps the map focused on the current set of visible pickup markers.
 */
const getRideMapCenter = (markers = []) => {
	if (!Array.isArray(markers) || markers.length === 0) {
		return null
	}

	const validMarkers = markers.filter(
		(marker) =>
			Number.isFinite(marker.latitude) &&
			Number.isFinite(marker.longitude)
	)

	if (validMarkers.length === 0) {
		return null
	}

	const latitude =
		validMarkers.reduce((sum, marker) => sum + marker.latitude, 0) /
		validMarkers.length
	const longitude =
		validMarkers.reduce((sum, marker) => sum + marker.longitude, 0) /
		validMarkers.length

	return { latitude, longitude }
}

/**
 * @brief Keeps only users that are available for the selected day and hour.
 * @param {Array<object>} users - All known users.
 * @param {object|null} currentUser - Logged-in user record.
 * @param {number} day - Selected weekday index.
 * @param {number} hour - Selected schedule slot.
 * @returns {Array<object>} Filtered list of users.
 * @details The current user is always retained so the page can still show their own marker even if no schedule match is found.
 */
const filterUsersByDayAndHour = (users, currentUser, day, hour) => {
	if (!Array.isArray(users)) return []

	return users.filter((user) => {
		if (!user?.uid) return false
		if (!hasValidCoordinates(user?.coords)) return false
		if (currentUser?.uid && user.uid === currentUser.uid) return true

		const userSchedule = user?.schedule || {}
		const userStart = userSchedule[day]?.start
		const userEnd = userSchedule[day]?.end

		if (!userStart || !userEnd) return false
		if (userStart == hour || userEnd == hour) return true

		return false
	})
}

/**
 * @brief Resolves the origin coordinates used to calculate route suggestions.
 * @details Prefers explicit query parameters and falls back to the current user's stored coordinates.
 * @param {object} req - Express request object.
 * @returns {{latitude: number, longitude: number}|null} Origin coordinates or null when unavailable.
 * @details This allows the route preview and suggestion list to work both from manual coordinates and from the signed-in user's profile.
 */
const resolveSuggestionOrigin = (req) => {
	const queryLatitude = Number(req.query?.lat)
	const queryLongitude = Number(req.query?.lon)

	if (Number.isFinite(queryLatitude) && Number.isFinite(queryLongitude)) {
		return { latitude: queryLatitude, longitude: queryLongitude }
	}

	const userCoords = req.user?.metadata?.coords
	if (hasValidCoordinates(userCoords)) {
		return {
			latitude: Number(userCoords.latitude),
			longitude: Number(userCoords.longitude)
		}
	}

	return null
}

/**
 * @brief Adds detour metrics to a marker object.
 * @param {object} marker - Original marker.
 * @param {number|null} detourDistanceKm - Extra distance in kilometers.
 * @param {number|null} detourDurationMinutes - Extra duration in minutes.
 * @returns {object} Marker with detour metadata.
 * @details The detour fields are attached in the same shape the front end expects when rendering badges.
 */
const normalizeDetourMarker = (
	marker,
	detourDistanceKm,
	detourDurationMinutes
) => ({
	...marker,
	detour: {
		distance: detourDistanceKm,
		duration: detourDurationMinutes
	}
})

/**
 * @brief Estimates the detour cost of picking up a marker before driving to school.
 * @param {{latitude: number, longitude: number}} originCoords - Current route origin.
 * @param {{latitude: number, longitude: number}} destinationCoords - Final destination.
 * @param {{latitude: number, longitude: number}} marker - Candidate pickup location.
 * @param {{distanceKm?: number, durationMinutes?: number}|null} referenceMetrics - Route metrics used for time estimation.
 * @returns {{detourDistanceKm: number, detourDurationMinutes: number}} Detour metrics.
 * @details The calculation compares the direct origin-to-destination path with the path that includes the pickup marker.
 */
const estimateDetourForMarker = (
	originCoords,
	destinationCoords,
	marker,
	referenceMetrics
) => {
	const directOriginToDestination = getDistanceInKm(
		originCoords,
		destinationCoords
	)
	const routeViaMarker =
		getDistanceInKm(originCoords, marker) +
		getDistanceInKm(marker, destinationCoords)
	const detourDistanceKm = Math.max(
		0,
		routeViaMarker - directOriginToDestination
	)
	const detourDurationMinutes = estimateMinutesFromDistance(
		detourDistanceKm,
		referenceMetrics
	)

	return {
		detourDistanceKm,
		detourDurationMinutes
	}
}

/**
 * @brief Sorts suggestions so preferred and shorter detours appear first.
 * @param {Array<object>} markers - Candidate suggestion list.
 * @returns {Array<object>} Sorted suggestion markers.
 * @details Preference matches are prioritized before shorter detours, with a stable name-based fallback for ties.
 */
const sortSuggestionMarkers = (markers) => {
	return [...markers].sort((left, right) => {
		const leftMatches = left?.matchesPreferences ? 1 : 0
		const rightMatches = right?.matchesPreferences ? 1 : 0
		if (leftMatches !== rightMatches) {
			return rightMatches - leftMatches
		}

		const leftDistance = Number(left?.detour?.distance)
		const rightDistance = Number(right?.detour?.distance)
		if (
			Number.isFinite(leftDistance) &&
			Number.isFinite(rightDistance) &&
			leftDistance !== rightDistance
		) {
			return leftDistance - rightDistance
		}

		const leftTitle = String(left?.title || '')
		const rightTitle = String(right?.title || '')
		return leftTitle.localeCompare(rightTitle, 'nl')
	})
}

/**
 * @brief Builds the final ride suggestions shown on the ride page.
 * @details Reuses the route when possible, filters markers to those on the route, and attaches detour metadata.
 * @param {{markers?: Array<object>, currentUser?: object|null, originCoords?: {latitude: number, longitude: number}|null, rideSettings?: object, baseRoute?: object|null}} options - Suggestion-building options.
 * @returns {Promise<Array<object>>} Ordered suggestion markers.
 * @details This is the central suggestion pipeline used by both the initial page render and the AJAX endpoint.
 */
const buildRideSuggestions = async ({
	markers = [],
	currentUser = null,
	originCoords = null,
	rideSettings = {},
	baseRoute = null
} = {}) => {
	if (!Array.isArray(markers) || markers.length === 0) {
		return []
	}

	const currentUserUid = currentUser?.uid || null
	const route =
		baseRoute || (originCoords ? await getBaseRoute(originCoords) : null)
	const routeMetrics = getRouteMetrics(route)
	const routeMarkers = route
		? findMarkersOnRoute(markers, route, SCHOOL_DESTINATION)
		: markers

	return sortSuggestionMarkers(
		routeMarkers
			.filter((marker) => marker?.uid && marker.uid !== currentUserUid)
			.map((marker) => {
				if (!originCoords || !SCHOOL_DESTINATION) {
					return {
						...marker,
						matchesPreferences: checkSuggestionWithPreferences(
							marker,
							rideSettings
						)
					}
				}

				const detour = estimateDetourForMarker(
					originCoords,
					SCHOOL_DESTINATION,
					marker,
					routeMetrics
				)

				const detourMarker = normalizeDetourMarker(
					marker,
					detour.detourDistanceKm,
					detour.detourDurationMinutes
				)

				return {
					...detourMarker,
					matchesPreferences: checkSuggestionWithPreferences(
						detourMarker,
						rideSettings
					)
				}
			})
	)
}

/**
 * @brief Assembles the full ride page payload for rendering and AJAX suggestions.
 * @param {object} req - Express request object.
 * @param {number} day - Selected weekday index.
 * @param {number} hour - Selected schedule slot.
 * @returns {Promise<object>} Render payload with map markers, route data, and suggestions.
 * @details The payload is shared by the page render and the suggestions endpoint so both stay in sync.
 */
const buildRidePayload = async (req, day, hour) => {
	const users = await getAllUsers()
	const filteredUsers = filterUsersByDayAndHour(users, req.user, day, hour)
	const mapMarkers = buildRideMarkers(filteredUsers, req.user?.uid)
	const mapCenter = getRideMapCenter(mapMarkers)
	const rideSettings = getRideSettings(req.user?.metadata?.preferences)
	const currentUserUid = req.user?.uid
	const currentUserMarker = mapMarkers.find(
		(marker) => marker.uid === currentUserUid
	)
	const originCoords = resolveSuggestionOrigin(req)

	const baseRoute = originCoords ? await getBaseRoute(originCoords) : null
	const suggestionMarkers = await buildRideSuggestions({
		markers: mapMarkers,
		currentUser: req.user,
		originCoords,
		rideSettings,
		baseRoute
	})

	return {
		mapMarkers: currentUserMarker ? [currentUserMarker] : [],
		rideSettings,
		mapCenter,
		route: baseRoute,
		suggestionMarkers
	}
}

/**
 * @brief Renders the ride page with the current user's route and suggestions.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @returns {Promise<object>} Rendered ride page or error notification.
 * @details The handler prepares the initial payload and falls back to a user-facing notification if rendering fails.
 */
export const getRidePage = async (req, res) => {
	try {
		const now = new Date()
		const payload = await buildRidePayload(
			req,
			now.getDay(),
			now.getHours()
		)

		return res.render('ride', {
			title: 'Ritten',
			...payload
		})
	} catch (error) {
		console.error('Error rendering ride page:', error)
		return respondWithNotification(res, {
			type: 'error',
			message:
				'Er is een fout opgetreden bij het laden van de ritpagina. Probeer het later opnieuw.',
			status: 500,
			view: 'ride',
			title: 'Ritten'
		})
	}
}

/**
 * @brief Returns the suggestion list for the selected weekday and time slot.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @returns {Promise<object>} JSON response containing ride suggestions.
 * @details This endpoint is called by the ride page when the user changes the selected schedule slot.
 */
export const getRideSuggestions = async (req, res) => {
	try {
		const day = toNonNegativeInteger(req.query.day)
		const hour = toNonNegativeInteger(req.query.hour)
		if (day === null || hour === null)
			return res.status(400).json({
				error: 'Ongeldige parameters: "day" en "hour" moeten niet-negatieve gehele getallen zijn.'
			})
		if (hour < 1 || hour > 8)
			return res.status(400).json({
				error: 'Ongeldige parameter: "hour" moet een waarde tussen 1 en 8 hebben.'
			})
		if (day < 1 || day > 5)
			return res.status(400).json({
				error: 'Ongeldige parameter: "day" moet een waarde tussen 1 en 5 hebben.'
			})

		const users = await getAllUsers()
		const filteredUsers = filterUsersByDayAndHour(
			users,
			req.user,
			day,
			hour
		)
		const mapMarkers = buildRideMarkers(filteredUsers, req.user?.uid)
		const rideSettings = getRideSettings(req.user?.metadata?.preferences)
		const originCoords = resolveSuggestionOrigin(req)
		const baseRoute = originCoords ? await getBaseRoute(originCoords) : null
		const suggestionMarkers = await buildRideSuggestions({
			markers: mapMarkers,
			currentUser: req.user,
			originCoords,
			rideSettings,
			baseRoute
		})

		return res.json(suggestionMarkers)
	} catch (error) {
		console.error('Error fetching ride suggestions:', error)
		return res.status(500).json({
			error: 'Er is een fout opgetreden bij het ophalen van rit suggesties. Probeer het later opnieuw.'
		})
	}
}

export const calculateRouteWithSuggestions = async (req, res) => {
	try {
		const originCoords = resolveSuggestionOrigin(req)
		if (!originCoords) {
			return res.status(400).json({
				error: 'Ongeldige parameters: "lat" en "lon" moeten geldige coördinaten bevatten.'
			})
		}
		const baseRoute = await getBaseRoute(originCoords)
		if (!baseRoute) {
			return res.status(500).json({
				error: 'Er is een fout opgetreden bij het berekenen van de route. Probeer het later opnieuw.'
			})
		}

		const users = await getAllUsers()
		const mapMarkers = buildRideMarkers(users, req.user?.uid)
		const currentUserMarker = mapMarkers.find(
			(marker) => marker.uid === req.user?.uid
		)
		const rideSettings = getRideSettings(req.user?.metadata?.preferences)
		const suggestionMarkers = await buildRideSuggestions({
			markers: mapMarkers,
			currentUser: req.user,
			originCoords,
			rideSettings,
			baseRoute
		})
		const selectedSuggestionIds = new Set(
			normalizeSuggestionIds(req.body?.suggestionIds)
		)
		const selectedSuggestionMarkers =
			selectedSuggestionIds.size > 0
				? suggestionMarkers.filter((marker) =>
						selectedSuggestionIds.has(String(marker?.uid))
					)
				: suggestionMarkers
		const seatLimit = rideSettings?.seats?.total || 1
		if (selectedSuggestionMarkers.length > seatLimit) {
			return res.status(400).json({
				error: `Je kunt maximaal ${seatLimit} personen selecteren.`
			})
		}
		// Build a cache key for this origin + selection to avoid repeated routing calls
		const originKey = `${originCoords.latitude.toFixed(5)},${originCoords.longitude.toFixed(5)}`
		const idsKey = selectedSuggestionMarkers
			.map((m) => String(m.uid || ''))
			.filter(Boolean)
			.sort()
			.join(',')
		const cacheKey = `route:${originKey}:ids:${idsKey || 'none'}`

		const cached = routeCache.get(cacheKey)
		if (cached && cached.expiresAt > Date.now()) {
			return res.json({
				route: cached.value,
				markers: currentUserMarker
					? [currentUserMarker, ...selectedSuggestionMarkers]
					: selectedSuggestionMarkers,
				cached: true
			})
		}

		let routeWithSuggestions = baseRoute
		if (selectedSuggestionMarkers.length > 0) {
			const optimizedWaypoints = optimizeWaypointOrder(
				originCoords,
				selectedSuggestionMarkers
			)
			routeWithSuggestions = await calculateRoute(
				originCoords,
				SCHOOL_DESTINATION,
				optimizedWaypoints
			)
			// cache the optimized route result briefly
			routeCache.set(cacheKey, {
				value: routeWithSuggestions,
				expiresAt: Date.now() + ROUTE_CACHE_TTL_MS
			})
		} else {
			// cache the base route for this origin as well (separate key used earlier by getBaseRoute),
			// but also keep this combined key so repeated empty selections are cheap
			routeCache.set(cacheKey, {
				value: baseRoute,
				expiresAt: Date.now() + ROUTE_CACHE_TTL_MS
			})
		}

		return res.json({
			route: routeWithSuggestions,
			markers: currentUserMarker
				? [currentUserMarker, ...selectedSuggestionMarkers]
				: selectedSuggestionMarkers,
			cached: false
		})
	} catch (error) {
		console.error('Error calculating ride route:', error)
		return res.status(500).json({
			error: 'Er is een fout opgetreden bij het berekenen van de route. Probeer het later opnieuw.'
		})
	}
}

export const saveRideRoute = async (req, res) => {
	try {
		const userUid = String(req.user?.uid || '')
		if (!userUid) {
			return res.status(401).json({
				error: 'Je moet aangemeld zijn om een rit op te slaan.'
			})
		}

		const day = toNonNegativeInteger(req.body?.day)
		const hour = toNonNegativeInteger(req.body?.hour)
		if (
			day === null ||
			hour === null ||
			day < 1 ||
			day > 5 ||
			hour < 1 ||
			hour > 8
		) {
			return res.status(400).json({
				error: 'Ongeldige parameters: "day" en "hour" moeten geldige roosterwaarden bevatten.'
			})
		}

		const route = req.body?.route
		if (!route || typeof route !== 'object') {
			return res.json({ saved: false, ignored: true })
		}

		const markers = Array.isArray(req.body?.markers) ? req.body.markers : []
		const suggestionIds = normalizeSuggestionIds(req.body?.suggestionIds)
		const slotKey = `${day}_${hour}`
		const nowIso = new Date().toISOString()
		const routeMetrics = getRouteMetrics(route)

		const record = {
			uid: userUid,
			day,
			hour,
			slotKey,
			suggestionIds,
			route,
			markers,
			routeMetrics,
			savedAt: nowIso,
			updatedAt: nowIso
		}

		await db.ref(`rides/${userUid}/${slotKey}`).set(record)

		return res.json({
			saved: true,
			slotKey,
			savedAt: nowIso
		})
	} catch (error) {
		console.error('Error saving ride route:', error)
		return res.status(500).json({
			error: 'Er is een fout opgetreden bij het opslaan van de rit. Probeer het later opnieuw.'
		})
	}
}
