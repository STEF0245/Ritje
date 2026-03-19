import { parseCoordinate, reverseGeocode, forwardGeocode } from './location.service.js'

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

		return res.status(isValidationError ? 400 : 502).json({
			error: error?.message || 'Reverse geocoding failed'
		})
	}
}

export const forwardGeocodeController = async (req, res) => {
	try {
		const address = req.body?.address
		if (typeof address !== 'string' || address.trim() === '') {
			throw new Error('Address must be a non-empty string')
		}

		const { provider, attribution, result } = await forwardGeocode(address)

		if (!result) {
			return res.status(404).json({
				error: 'No coordinates found for provided address',
				provider,
				attribution
			})
		}

		res.setHeader('X-Geocoding-Provider', provider)
		res.setHeader('X-Geocoding-Provider-Name', attribution.name)

		return res.status(200).json({
			address,
			provider,
			attribution,
			lat: result.lat,
			lon: result.lon,
			raw: result.raw
		})
	} catch (error) {
		const isValidationError =
			typeof error?.message === 'string' &&
			error.message.includes('must be')

		return res.status(isValidationError ? 400 : 502).json({
			error: error?.message || 'Forward geocoding failed'
		})
	}
}
