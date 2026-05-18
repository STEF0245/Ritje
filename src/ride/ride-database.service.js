/**
 * @file Ride database operations.
 * @brief CRUD operations for ride records in Firebase.
 */

import db from '../firebase/db.js'
import { buildRideRecordKey, isRideCanceled } from './ride-status.util.js'
import { getRouteMetrics } from './route-metrics.util.js'
import { buildRidePassengers } from './ride-status.util.js'
import { sendEmail } from '../utils/email.util.js'
import { sendCancellationEmails } from './ride-email.service.js'

/**
 * @brief Retrieves a specific ride record.
 * @param {string} userUid - Driver's UID.
 * @param {number} day - Weekday index.
 * @param {number} hour - Schedule slot.
 * @returns {Promise<object|null>} - Ride record or null if not found.
 */
export const getRideRecord = async (userUid, day, hour) => {
	const key = buildRideRecordKey(userUid, day, hour)
	const snapshot = await db.ref(key).once('value')
	return snapshot.val() || null
}

/**
 * @brief Retrieves the most recent active ride for a user.
 * @param {string} userUid - User's UID.
 * @returns {Promise<{ride: object, rideKey: string}|null>} - Latest ride and key or null.
 */
export const getLatestActiveRide = async (userUid) => {
	const snapshot = await db.ref(`rides/${userUid}`).once('value')
	const rides = snapshot.val() || {}

	let latestActive = null
	let latestKey = null
	let latestTimestamp = 0

	for (const [rideKey, ride] of Object.entries(rides)) {
		if (!ride || isRideCanceled(ride)) continue

		const updatedAt = Date.parse(ride.updatedAt || ride.savedAt || '')
		const ts = Number.isFinite(updatedAt) ? updatedAt : 0

		if (!latestActive || ts > latestTimestamp) {
			latestActive = ride
			latestKey = rideKey
			latestTimestamp = ts
		}
	}

	return latestActive ? { ride: latestActive, rideKey: latestKey } : null
}

/**
 * @brief Checks if a user has an active ride for a specific day/hour, optionally excluding one.
 * @param {string} userUid - User's UID.
 * @param {number} day - Weekday index.
 * @param {number} hour - Schedule slot.
 * @param {string|null} excludeRideKey - Optional key to exclude from check.
 * @returns {Promise<boolean>} - True if another active ride exists.
 */
export const hasAnotherActiveRide = async (
	userUid,
	day,
	hour,
	excludeRideKey = null
) => {
	const snapshot = await db.ref(`rides/${userUid}`).once('value')
	const rides = snapshot.val() || {}

	for (const [rideKey, ride] of Object.entries(rides)) {
		if (!ride || isRideCanceled(ride)) continue
		if (excludeRideKey && String(rideKey) === String(excludeRideKey))
			continue

		if (
			Number(ride.day) === Number(day) &&
			Number(ride.hour) === Number(hour)
		) {
			return true
		}
	}

	return false
}

/**
 * @brief Saves a new ride record to the database.
 * @param {string} userUid - Driver's UID.
 * @param {number} day - Weekday index.
 * @param {number} hour - Schedule slot.
 * @param {object} route - Route object (GeoJSON or similar).
 * @param {Array<object>} markers - Ride markers.
 * @param {string[]} passengers - Selected passenger UIDs.
 * @returns {Promise<object>} - Saved ride record.
 */
export const saveRide = async (
	userUid,
	day,
	hour,
	route,
	markers,
	passengers
) => {
	const key = buildRideRecordKey(userUid, day, hour)
	const nowIso = new Date().toISOString()
	const routeMetrics = getRouteMetrics(route)

	const record = {
		uid: userUid,
		day,
		hour,
		status: 'active',
		passengers: buildRidePassengers(passengers),
		route,
		markers,
		routeMetrics,
		savedAt: nowIso,
		updatedAt: nowIso
	}

	await db.ref(key).set(record)
	return record
}

/**
 * @brief Cancels an active ride record.
 * @param {string} userUid - Driver's UID.
 * @param {number} day - Weekday index.
 * @param {number} hour - Schedule slot.
 * @returns {Promise<object|null>} - Updated ride record or null if not found.
 */
export const cancelRide = async (userUid, day, hour) => {
	const ride = await getRideRecord(userUid, day, hour)
	if (!ride) return null

	const key = buildRideRecordKey(userUid, day, hour)
	const nowIso = new Date().toISOString()

	await sendCancellationEmails(ride.passengers, userUid, day, hour)

	const updatedRide = {
		...ride,
		status: 'canceled',
		canceledAt: nowIso,
		updatedAt: nowIso
	}

	await db.ref(key).set(updatedRide)
	return updatedRide
}

/**
 * @brief Updates a passenger's response to a ride invitation.
 * @param {string} driverUid - Driver's UID.
 * @param {number} day - Weekday index.
 * @param {number} hour - Schedule slot.
 * @param {string} passengerUid - Passenger's UID.
 * @param {string} responseStatus - Response status ('accepted' or 'rejected').
 * @returns {Promise<object|null>} - Updated ride record or null if ride not found.
 */
export const updatePassenger = async (
	driverUid,
	day,
	hour,
	passengerUid,
	responseStatus
) => {
	const key = buildRideRecordKey(driverUid, day, hour)
	const snapshot = await db.ref(key).once('value')
	const ride = snapshot.val()

	if (!ride || isRideCanceled(ride)) return null

	if (!ride.passengers || !ride.passengers[passengerUid]) return null

	const nowIso = new Date().toISOString()
	await db.ref(`${key}/passengers/${passengerUid}`).set({
		status: responseStatus,
		respondedAt: nowIso
	})

	return {
		...ride,
		passengers: {
			...(ride.passengers || {}),
			[passengerUid]: {
				status: responseStatus,
				respondedAt: nowIso
			}
		}
	}
}
