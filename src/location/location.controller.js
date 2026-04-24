/**
 * @file Location controller for reverse geocoding requests.
 * @brief  Validates coordinates and proxies the geocoding response.
 * @details  Parses request coordinates, delegates lookup to the location service, and returns provider metadata with normalized payloads.
 */

import { parseCoordinate, reverseGeocode } from './location.service.js'

/**
 * @brief  Reverse geocode the provided latitude and longitude.
 * @details  Returns HTTP 404 when no address can be resolved, HTTP 400 for validation errors, and HTTP 502 for provider failures.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @returns {Promise<object>} Express response.
 * @throws {Error} Throws when coordinate parsing or geocoding fails.
 */
export const reverseGeocodeController = async (req, res) => {
	try {
		const lat = parseCoordinate(req.body?.lat, 'lat', -90, 90)
		const lon = parseCoordinate(req.body?.lon, 'lon', -180, 180)

		const { provider, attribution, result } = await reverseGeocode(lat, lon)

		if (!result) {
			return res.status(404).json({
				error: 'No address found for provided coordinates',
				provider,
				attribution
			})
		}

		res.setHeader('X-Geocoding-Provider', provider)
		res.setHeader('X-Geocoding-Provider-Name', attribution.name)

		return res.status(200).json({
			lat,
			lon,
			provider,
			attribution,
			displayName: result.displayName,
			address: result.address,
			raw: result.raw
		})
	} catch (error) {
		const isValidationError =
			typeof error?.message === 'string' &&
			error.message.includes('must be')
		const safeMessage = isValidationError
			? 'Invalid coordinates provided'
			: 'Reverse geocoding failed'

		return res.status(isValidationError ? 400 : 502).json({
			error: safeMessage
		})
	}
}

/**
 * @brief  Placeholder endpoint for forward geocoding.
 * @details  Returns HTTP 501 until forward geocoding is exposed through this controller.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @returns {object} Express response.
 */
export const forwardGeocodeController = async (req, res) => {
	res.status(501).json({
		error: 'Forward geocoding is not implemented yet'
	})
}
