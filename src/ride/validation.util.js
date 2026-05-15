/**
 * @file Validation utilities for ride parameters.
 * @brief Validates and normalizes ride-related input values.
 */

/**
 * @brief Converts a value to a non-negative integer or returns null.
 * @param {*} value - The value to convert.
 * @returns {number|null} - Non-negative integer or null if invalid.
 */
export const toNonNegativeInteger = (value) => {
	const parsed = Number(value)
	if (!Number.isFinite(parsed)) return null
	if (!Number.isInteger(parsed) || parsed < 0) return null
	return parsed
}

/**
 * @brief Normalizes an array of suggestion IDs to strings.
 * @param {*} value - The value to normalize.
 * @returns {string[]} - Array of string IDs, or empty array if invalid.
 */
export const normalizeSuggestionIds = (value) => {
	if (!Array.isArray(value)) return []
	return value.map((id) => String(id)).filter(Boolean)
}

/**
 * @brief Validates day and hour parameters are within valid schedule ranges.
 * @param {number} day - Weekday index (0-6 or 1-5).
 * @param {number} hour - Schedule slot (1-8).
 * @returns {boolean} - True if both are valid.
 */
export const isValidDayAndHour = (day, hour) => {
	return day >= 1 && day <= 5 && hour >= 1 && hour <= 8
}

/**
 * @brief Validates a day parameter is within school week range.
 * @param {number} day - Weekday index.
 * @returns {boolean} - True if valid (1-5).
 */
export const isValidDay = (day) => {
	return day >= 1 && day <= 5
}

/**
 * @brief Validates an hour parameter is within school schedule range.
 * @param {number} hour - Schedule slot.
 * @returns {boolean} - True if valid (1-8).
 */
export const isValidHour = (hour) => {
	return hour >= 1 && hour <= 8
}

/**
 * @brief Validates a seat count is positive.
 * @param {number} seats - Number of seats.
 * @returns {boolean} - True if valid (> 0).
 */
export const isValidSeatCount = (seats) => {
	const count = Number(seats)
	return Number.isFinite(count) && count > 0
}
