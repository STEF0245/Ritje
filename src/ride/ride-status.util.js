/**
 * @file Ride status checking and management utilities.
 * @brief Checks ride status, cancellation, and related properties.
 */

/**
 * @brief Gets the normalized status string from a ride record.
 * @param {object} ride - The ride record.
 * @returns {string} - Lowercase status string (default 'active').
 */
export const getRideStatus = (ride) => {
	return String(ride?.status || 'active').toLowerCase()
}

/**
 * @brief Checks if a ride is canceled.
 * @param {object} ride - The ride record.
 * @returns {boolean} - True if status is 'canceled'.
 */
export const isRideCanceled = (ride) => {
	return getRideStatus(ride) === 'canceled'
}

/**
 * @brief Checks if a ride is active (not canceled).
 * @param {object} ride - The ride record.
 * @returns {boolean} - True if status is not 'canceled'.
 */
export const isRideActive = (ride) => {
	return !isRideCanceled(ride)
}

/**
 * @brief Builds initial passenger response map for suggestions.
 * @param {string[]} passengers - UIDs of suggested passengers.
 * @returns {object} - Map of UID to pending response object.
 */
export const buildRidePassengerResponses = (passengers = []) => {
	return passengers.reduce((responses, uid) => {
		responses[uid] = {
			status: 'pending',
			respondedAt: null
		}
		return responses
	}, {})
}

/**
 * @brief Generates a database key for a specific ride record.
 * @param {string} userUid - Driver's UID.
 * @param {number} day - Weekday index.
 * @param {number} hour - Schedule slot.
 * @returns {string} - Firebase database key path.
 */
export const buildRideRecordKey = (userUid, day, hour) => {
	return `rides/${userUid}/${day}_${hour}`
}
