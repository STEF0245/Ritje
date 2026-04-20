/**
 * @file Ride controller for handling ride page requests.
 * @brief  Provides the handler for rendering the main ride page.
 * @details  Responds to GET requests for the ride page by rendering the appropriate view with necessary data.
 */

import db from '../firebase/db.js'
import { respondWithNotification } from '../utils/notification.util.js'

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

const buildRideMarkers = (users = []) => {
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
				title: user?.name?.full || 'Onbekende gebruiker',
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
		const mapMarkers = buildRideMarkers(users)
		const mapCenter = getRideMapCenter(mapMarkers)

		res.render('ride', {
			title: 'Ritje',
			mapMarkers,
			mapCenter
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
