/**
 * @file Shared address validation and geocoding helpers.
 * @brief  Normalizes address input, geocoding timeouts, and provider results.
 * @details  Contains reusable helpers used by both profile and admin flows to validate address input and normalize geocoding output.
 */

import { sanitizeText, validateLength } from './input.util.js'

const ADDRESS_PATTERNS = {
	street: /^(?=.{2,120}$)[\p{L}\p{N} .,'\-\/]+$/u,
	houseNumber: /^(?=.{1,20}$)[\p{L}\p{N} .\-\/]+$/u,
	postalCode: /^(?=.{2,20}$)[\p{L}\p{N} \-]+$/u,
	city: /^(?=.{2,100}$)[\p{L}\p{N} .,'\-]+$/u
}

/**
 * @brief  Validate and normalize address fields from a form payload.
 * @details  Trims and constrains the street, house number, postal code, and city fields.
 * @param {object} body - Incoming request body or partial address object.
 * @returns {{street: string, houseNumber: string, postalCode: string, city: string}} Normalized address fields.
 * @throws {Error} Throws when a field is missing, too short, or contains invalid characters.
 */
export const parseAndValidateAddress = (body = {}) => {
	const street = sanitizeText(body.street, 120)
	const houseNumber = sanitizeText(body.houseNumber, 20)
	const postalCode = sanitizeText(body.postalCode, 20)
	const city = sanitizeText(body.city, 100)

	validateLength(street, 'Street', 2, 120)
	validateLength(houseNumber, 'House number', 1, 20)
	validateLength(postalCode, 'Postal code', 2, 20)
	validateLength(city, 'City', 2, 100)

	if (!ADDRESS_PATTERNS.street.test(street)) {
		throw new Error('Street contains invalid characters')
	}

	if (!ADDRESS_PATTERNS.houseNumber.test(houseNumber)) {
		throw new Error('House number contains invalid characters')
	}

	if (!ADDRESS_PATTERNS.postalCode.test(postalCode)) {
		throw new Error('Postal code contains invalid characters')
	}

	if (!ADDRESS_PATTERNS.city.test(city)) {
		throw new Error('City contains invalid characters')
	}

	return {
		street,
		houseNumber,
		postalCode,
		city
	}
}

/**
 * @brief  Run an async geocoding operation with an abort timeout.
 * @details  Creates an AbortController, aborts after the timeout, and clears the timer in all cases.
 * @param {(signal: AbortSignal) => Promise<unknown>} promiseFactory - Factory that receives the abort signal.
 * @param {number} timeoutMs - Timeout in milliseconds.
 * @returns {Promise<unknown>} Resolves with the promiseFactory result.
 * @throws {Error} Throws when the wrapped promise rejects or the operation times out.
 */
export const withTimeout = async (promiseFactory, timeoutMs) => {
	const controller = new AbortController()
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

	try {
		return await promiseFactory(controller.signal)
	} finally {
		clearTimeout(timeoutId)
	}
}

/**
 * @brief  Normalize geocoder output into the address shape used by the app.
 * @details  Falls back to the original user-supplied values when the provider does not return a field.
 * @param {object} rawAddress - Raw provider address object.
 * @param {{street: string, houseNumber: string, postalCode: string, city: string}} fallbackAddress - User-provided address fields.
 * @returns {{street: string, houseNumber: string, postalCode: string, city: string}} Normalized address object.
 */
export const normalizeGeocodedAddress = (
	rawAddress = {},
	fallbackAddress = {}
) => {
	return {
		street: rawAddress.street || fallbackAddress.street || '',
		houseNumber:
			rawAddress.housenumber || fallbackAddress.houseNumber || '',
		postalCode: rawAddress.postcode || fallbackAddress.postalCode || '',
		city:
			rawAddress.village ||
			rawAddress.city ||
			rawAddress.town ||
			fallbackAddress.city ||
			''
	}
}
