/**
 * @file Input normalization and validation helpers.
 * @brief  Sanitizes text, validates lengths, and checks common formats.
 * @details  Provides reusable utility functions to normalize user-provided strings and validate commonly used input constraints.
 */

/**
 * @brief  Trim and truncate a raw value.
 * @details  Converts nullish values to an empty string, trims surrounding whitespace, and limits output length.
 * @param {unknown} value - Raw incoming value.
 * @param {number} [maxLength=255] - Maximum length of the output string.
 * @returns {string} Trimmed and length-limited string.
 */
export const safeTrim = (value, maxLength = 255) => {
	return `${value ?? ''}`.trim().slice(0, maxLength)
}

/**
 * @brief  Normalize and sanitize a text value.
 * @details  Applies Unicode normalization, removes control characters, collapses repeated whitespace, trims, and truncates to max length.
 * @param {unknown} value - Raw incoming value.
 * @param {number} [maxLength=255] - Maximum length of the output string.
 * @returns {string} Sanitized text.
 */
export const sanitizeText = (value, maxLength = 255) => {
	return `${value ?? ''}`
		.normalize('NFKC')
		.replace(/[\u0000-\u001F\u007F]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, maxLength)
}

/**
 * @brief  Validate minimum and maximum string length.
 * @details  Throws when a value falls outside expected bounds so callers can return validation feedback.
 * @param {string} value - Value to validate.
 * @param {string} label - Field label used in the error message.
 * @param {number} minLength - Minimum allowed length.
 * @param {number} maxLength - Maximum allowed length.
 * @returns {void}
 * @throws {Error} Throws when the value length is outside the allowed range.
 */
export const validateLength = (value, label, minLength, maxLength) => {
	if (value.length < minLength || value.length > maxLength) {
		throw new Error(`${label} has an invalid length`)
	}
}

/**
 * @brief  Validate whether a value is an HTTPS URL.
 * @details  Empty values are treated as valid so optional URL fields can be left blank.
 * @param {string} value - URL value to validate.
 * @returns {boolean} True when the URL is empty or uses the HTTPS protocol.
 */
export const isValidHttpsUrl = (value) => {
	if (!value) return true
	try {
		const parsed = new URL(value)
		return parsed.protocol === 'https:'
	} catch {
		return false
	}
}

/**
 * @brief  Validate whether a value is an email address.
 * @details  Uses a lightweight regex suitable for basic form validation.
 * @param {string} value - Email value to validate.
 * @returns {boolean} True when the value matches the expected email shape.
 */
export const isValidEmail = (value) => {
	if (!value) return false
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}
