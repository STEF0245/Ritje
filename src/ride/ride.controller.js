/**
 * @file Ride controller for handling ride page requests.
 * @brief  Provides the handler for rendering the main ride page.
 * @details  Responds to GET requests for the ride page by rendering the appropriate view with necessary data.
 */

import db from '../firebase/db.js'
import config from '../config.js'
import { respondWithNotification } from '../utils/notification.util.js'
import {
	calculateRoute,
	findMarkersOnRoute
} from '../location/location.service.js'

const SCHOOL_DESTINATION = config.ride.schoolDestination
const MAX_EXACT_OPTIMIZATION_WAYPOINTS = 8

/**
 * @brief  Check whether a coordinate pair is valid.
 * @param {{latitude?: number|string, longitude?: number|string}|null|undefined} point - Coordinate pair candidate.
 * @returns {boolean} True when latitude and longitude are finite numbers.
 */
const hasValidCoordinates = (point) => {
	const latitude = Number(point?.latitude)
	const longitude = Number(point?.longitude)
	return Number.isFinite(latitude) && Number.isFinite(longitude)
}

/**
 * @brief  Compute great-circle distance between two coordinates.
 * @param {{latitude: number, longitude: number}} start - Start coordinates.
 * @param {{latitude: number, longitude: number}} end - End coordinates.
 * @returns {number} Distance in kilometers.
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
 * @brief  Calculate total path cost from origin through waypoints to destination.
 * @param {{latitude: number, longitude: number}} origin - Origin coordinates.
 * @param {{latitude: number, longitude: number}} destination - Destination coordinates.
 * @param {Array<{latitude: number, longitude: number}>} waypoints - Ordered waypoints.
 * @returns {number} Approximate path distance in kilometers.
 */
const getPathCostInKm = (origin, destination, waypoints = []) => {
	const points = [origin, ...waypoints, destination]

	let totalDistance = 0
	for (let index = 0; index < points.length - 1; index += 1) {
		totalDistance += getDistanceInKm(points[index], points[index + 1])
	}

	return totalDistance
}

/**
 * @brief  Find the best waypoint order by exhaustive search.
 * @param {{latitude: number, longitude: number}} origin - Origin coordinates.
 * @param {{latitude: number, longitude: number}} destination - Destination coordinates.
 * @param {Array<object>} waypoints - Unordered waypoint markers.
 * @returns {Array<object>} Optimized waypoint order.
 */
const optimizeWaypointOrderExact = (origin, destination, waypoints = []) => {
	let bestOrder = [...waypoints]
	let bestCost = Number.POSITIVE_INFINITY

	const search = (remainingWaypoints, currentOrder) => {
		if (remainingWaypoints.length === 0) {
			const candidateCost = getPathCostInKm(
				origin,
				destination,
				currentOrder
			)
			if (candidateCost < bestCost) {
				bestCost = candidateCost
				bestOrder = [...currentOrder]
			}
			return
		}

		for (let index = 0; index < remainingWaypoints.length; index += 1) {
			const nextWaypoint = remainingWaypoints[index]
			const nextRemaining = [
				...remainingWaypoints.slice(0, index),
				...remainingWaypoints.slice(index + 1)
			]
			search(nextRemaining, [...currentOrder, nextWaypoint])
		}
	}

	search(waypoints, [])
	return bestOrder
}

/**
 * @brief  Find a near-optimal waypoint order with nearest-neighbor heuristic.
 * @param {{latitude: number, longitude: number}} origin - Origin coordinates.
 * @param {Array<object>} waypoints - Unordered waypoint markers.
 * @returns {Array<object>} Heuristic waypoint order.
 */
const optimizeWaypointOrderGreedy = (origin, waypoints = []) => {
	const remaining = [...waypoints]
	const ordered = []
	let currentPoint = origin

	while (remaining.length > 0) {
		let nearestIndex = 0
		let nearestDistance = Number.POSITIVE_INFINITY

		for (let index = 0; index < remaining.length; index += 1) {
			const candidate = remaining[index]
			const candidateDistance = getDistanceInKm(currentPoint, candidate)
			if (candidateDistance < nearestDistance) {
				nearestDistance = candidateDistance
				nearestIndex = index
			}
		}

		const [selectedWaypoint] = remaining.splice(nearestIndex, 1)
		ordered.push(selectedWaypoint)
		currentPoint = selectedWaypoint
	}

	return ordered
}

/**
 * @brief  Build an optimized waypoint order for route preview.
 * @param {{latitude: number, longitude: number}} origin - Origin coordinates.
 * @param {{latitude: number, longitude: number}} destination - Destination coordinates.
 * @param {Array<object>} waypoints - Unordered waypoint markers.
 * @returns {Array<object>} Optimized waypoint markers.
 */
const optimizeWaypointOrder = (origin, destination, waypoints = []) => {
	if (!Array.isArray(waypoints) || waypoints.length <= 1) {
		return Array.isArray(waypoints) ? [...waypoints] : []
	}

	if (waypoints.length <= MAX_EXACT_OPTIMIZATION_WAYPOINTS) {
		return optimizeWaypointOrderExact(origin, destination, waypoints)
	}

	return optimizeWaypointOrderGreedy(origin, waypoints)
}

/**
 * @brief  Extract route distance/time metrics from GeoJSON route.
 * @param {object|null} route - GeoJSON route payload.
 * @returns {{distanceKm: number, durationMinutes: number}|null} Route metrics.
 */
const getRouteMetrics = (route) => {
	const distanceMeters = Number(route?.features?.[0]?.properties?.distance)
	const durationSeconds = Number(route?.features?.[0]?.properties?.time)

	if (!Number.isFinite(distanceMeters) || !Number.isFinite(durationSeconds)) {
		return null
	}

	return {
		distanceKm: distanceMeters / 1000,
		durationMinutes: durationSeconds / 60
	}
}

/**
 * @brief  Enrich suggestions with additional detour metrics.
 * @param {Array<object>} suggestionMarkers - Route suggestion markers.
 * @param {{latitude: number, longitude: number}} userCoords - Current user coordinates.
 * @param {object|null} baseRoute - Baseline route without pickups.
 * @returns {Promise<Array<object>>} Suggestion markers with extra km/min values.
 */
const enrichSuggestionsWithDetourMetrics = async (
	suggestionMarkers,
	userCoords,
	baseRoute
) => {
	const baseMetrics = getRouteMetrics(baseRoute)
	if (!baseMetrics) {
		return suggestionMarkers
	}

	const enrichedSuggestions = await Promise.all(
		suggestionMarkers.map(async (marker) => {
			try {
				const pickupRoute = await calculateRoute(
					userCoords,
					SCHOOL_DESTINATION,
					[
						{
							latitude: marker.latitude,
							longitude: marker.longitude
						}
					]
				)
				const pickupMetrics = getRouteMetrics(pickupRoute)

				if (!pickupMetrics) {
					return marker
				}

				const detourDistanceKm = Math.max(
					0,
					pickupMetrics.distanceKm - baseMetrics.distanceKm
				)
				const detourDurationMinutes = Math.max(
					0,
					pickupMetrics.durationMinutes - baseMetrics.durationMinutes
				)

				return {
					...marker,
					detourDistanceKm,
					detourDurationMinutes
				}
			} catch {
				return marker
			}
		})
	)

	return enrichedSuggestions.sort((first, second) => {
		const firstDistance = Number(first?.detourDistanceKm)
		const secondDistance = Number(second?.detourDistanceKm)

		if (
			!Number.isFinite(firstDistance) &&
			!Number.isFinite(secondDistance)
		) {
			return 0
		}
		if (!Number.isFinite(firstDistance)) return 1
		if (!Number.isFinite(secondDistance)) return -1

		return firstDistance - secondDistance
	})
}

/**
 * @brief  Fetch all user profiles from Firebase.
 * @details  Returns an empty array when no users are found or when retrieval fails.
 * @returns {Promise<Array<object>>} User list.
 */
const getAllUsers = async () => {
	try {
		const snapshot = await db.ref('users').once('value')
		const users = snapshot.val()
		return users ? Object.values(users) : []
	} catch (error) {
		console.error('Error fetching user locations:', error)
		return []
	}
}

/**
 * @brief  Build map marker payloads for the ride page.
 * @details  Converts users with valid coordinates into normalized marker objects including address lines and Google Maps links.
 * @param {Array<object>} [users=[]] - User list.
 * @param {string} uid - Logged-in user id to label the current user's marker.
 * @returns {Array<object>} Marker objects.
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
 * @brief  Calculate the average center of valid marker coordinates.
 * @param {Array<{latitude: number, longitude: number}>} [markers=[]] - Marker list.
 * @returns {{latitude: number, longitude: number}|null} Averaged center or null when unavailable.
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
 * @brief  Render the main ride page.
 * @details  Responds to GET requests for the ride page by rendering the 'ride' template with a title and any necessary notifications.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @returns {object} Express response.
 * @throws {Error} If rendering the ride page fails, an error is thrown and a notification is created for the user.
 */
export const getRidePage = async (req, res) => {
	try {
		const users = await getAllUsers()
		const mapMarkers = buildRideMarkers(users, req.user?.uid)
		const mapCenter = getRideMapCenter(mapMarkers)
		const currentUserUid = req.user?.uid
		const currentUserMarker = mapMarkers.find(
			(marker) => marker.uid === currentUserUid
		)

		const userCoords = req.user?.metadata?.coords
		const hasValidRouteEndpoints =
			hasValidCoordinates(userCoords) &&
			hasValidCoordinates(SCHOOL_DESTINATION)

		const standardRoute = hasValidRouteEndpoints
			? await calculateRoute(userCoords, SCHOOL_DESTINATION)
			: null

		const visibleMarkers = standardRoute
			? findMarkersOnRoute(mapMarkers, standardRoute, SCHOOL_DESTINATION)
			: mapMarkers
		const suggestionMarkers = visibleMarkers.filter(
			(marker) => marker.uid && marker.uid !== currentUserUid
		)
		const suggestionMarkersWithDetour = hasValidRouteEndpoints
			? await enrichSuggestionsWithDetourMetrics(
					suggestionMarkers,
					userCoords,
					standardRoute
				)
			: suggestionMarkers
		const initialMapMarkers = currentUserMarker ? [currentUserMarker] : []

		res.render('ride', {
			title: 'Ritje',
			mapMarkers: initialMapMarkers,
			suggestionMarkers: suggestionMarkersWithDetour,
			mapCenter,
			route: standardRoute
		})
	} catch (error) {
		console.error('Error rendering ride page:', error)
		return respondWithNotification(res, {
			type: 'error',
			message:
				'Er is een fout opgetreden bij het laden van de ritpagina. Probeer het later opnieuw.',
			status: 500,
			view: 'ride',
			title: 'Ritje'
		})
	}
}

/**
 * @brief  Recalculate ride route with selected suggestion waypoints.
 * @details  Uses current user coordinates as origin, school destination as destination, and selected suggestion coordinates as ordered waypoints.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @returns {Promise<object>} Express response.
 */
export const postRideRoutePreview = async (req, res) => {
	try {
		const selectedUids = Array.isArray(req.body?.selectedUids)
			? req.body.selectedUids
					.map((uid) => `${uid || ''}`.trim())
					.filter(Boolean)
			: []

		const uniqueSelectedUids = Array.from(new Set(selectedUids))
		const currentUserUid = req.user?.uid

		const users = await getAllUsers()
		const allMarkers = buildRideMarkers(users, currentUserUid)

		const currentUserMarker = allMarkers.find(
			(marker) => marker.uid === currentUserUid
		)
		const selectedMarkers = allMarkers.filter(
			(marker) =>
				marker.uid &&
				marker.uid !== currentUserUid &&
				uniqueSelectedUids.includes(marker.uid)
		)

		const userCoords = req.user?.metadata?.coords
		if (
			!hasValidCoordinates(userCoords) ||
			!hasValidCoordinates(SCHOOL_DESTINATION)
		) {
			return res.status(400).json({
				error: 'Ongeldige route-eindpunten voor herberekening.'
			})
		}

		const orderedSelectedMarkers = optimizeWaypointOrder(
			userCoords,
			SCHOOL_DESTINATION,
			selectedMarkers
		)
		const route = await calculateRoute(
			userCoords,
			SCHOOL_DESTINATION,
			orderedSelectedMarkers.map((marker) => ({
				latitude: marker.latitude,
				longitude: marker.longitude
			}))
		)

		return res.status(200).json({
			route,
			markers: [currentUserMarker, ...orderedSelectedMarkers].filter(
				Boolean
			)
		})
	} catch (error) {
		console.error('Error recalculating ride route:', error)
		return res.status(500).json({
			error: 'Er is een fout opgetreden bij het herberekenen van de route. Probeer het later opnieuw.'
		})
	}
}
