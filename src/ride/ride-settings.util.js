/**
 * @file Ride settings and preferences utilities.
 * @brief Builds and normalizes ride settings from user preferences.
 */

/**
 * @brief Retrieves nested value from object using key path.
 * @param {object} source - Object to traverse.
 * @param {string[]} path - Array of keys.
 * @returns {*} - Value at path or undefined.
 */
const getNestedValue = (source, path = []) => {
	return path.reduce((current, key) => current?.[key], source)
}

/**
 * @brief Normalizes and validates ride settings from user preferences.
 * @param {object} preferences - User's stored preferences.
 * @returns {{seats: {total: number}, detour: {distance: number|null, duration: number|null}}} - Normalized settings.
 */
export const buildRideSettings = (preferences = {}) => {
	return {
		seats: {
			total: Math.max(
				1,
				Number(getNestedValue(preferences, ['seats', 'total'])) || 1
			)
		},
		detour: {
			distance:
				getNestedValue(preferences, ['detour', 'distance']) || null,
			duration:
				getNestedValue(preferences, ['detour', 'duration']) || null
		}
	}
}
