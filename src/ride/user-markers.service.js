/**
 * @file User data and marker building utilities.
 * @brief Loads users and converts them to map markers for display.
 */

import db from '../firebase/db.js'
import { hasValidCoordinates } from './coordinates.util.js'

const USERS_CACHE_TTL_MS = 30 * 1000 // 30 seconds

let cachedUsers = {
	value: null,
	expiresAt: 0
}

/**
 * @brief Retrieves all users, with short-lived caching.
 * @details Cache reduces Firebase hits when multiple ride requests are made quickly.
 * @returns {Promise<Array<object>>} - List of all user records.
 */
export const getAllUsers = async () => {
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
		console.error('Error fetching all users:', error)
		return []
	}
}

/**
 * @brief Converts users to map markers with metadata.
 * @param {Array<object>} users - User list to convert.
 * @param {string|null} currentUserUid - Current logged-in user UID.
 * @returns {Array<object>} - Normalized marker objects with maps links.
 */
export const buildMarkers = (users = [], currentUserUid) => {
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
					currentUserUid === user?.uid
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
 * @brief Filters users by their availability for a specific day and hour.
 * @param {Array<object>} users - Users to filter.
 * @param {object|null} currentUser - Logged-in user (always included).
 * @param {number} day - Weekday index.
 * @param {number} hour - Schedule slot.
 * @returns {Array<object>} - Filtered user list.
 */
export const filterUsersBySchedule = (users, currentUser, day, hour) => {
	if (!Array.isArray(users)) return []

	return users.filter((user) => {
		if (!user?.uid) return false
		if (!hasValidCoordinates(user?.coords)) return false

		// Always include current user
		if (currentUser?.uid && user.uid === currentUser.uid) return true

		const userSchedule = user?.schedule || {}
		const userStart = userSchedule[day]?.start
		const userEnd = userSchedule[day]?.end

		if (!userStart || !userEnd) return false

		// Include if user starts or ends at this hour
		return userStart == hour || userEnd == hour
	})
}

/**
 * @brief Resolves origin coordinates from query params or current user profile.
 * @param {object} req - Express request object.
 * @returns {{latitude: number, longitude: number}|null} - Origin coordinates or null.
 */
export const resolveOriginCoordinates = (req) => {
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
