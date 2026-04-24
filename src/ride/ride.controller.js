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

		res.render('ride', {
			title: 'Ritje',
			mapMarkers: visibleMarkers,
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
