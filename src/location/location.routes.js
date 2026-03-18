import express from 'express'

const router = express.Router()

const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/reverse'
const NOMINATIM_USER_AGENT =
	process.env.GEOCODER_USER_AGENT ||
	'Ritje/1.0 (reverse geocoding endpoint; contact: admin@example.com)'

const parseCoordinate = (value, label, min, max) => {
	const parsed = Number(value)

	if (!Number.isFinite(parsed)) {
		throw new Error(`${label} must be a valid number`)
	}

	if (parsed < min || parsed > max) {
		throw new Error(`${label} must be between ${min} and ${max}`)
	}

	return parsed
}

router.post('/reverse-geocode', async (req, res) => {
	try {
		const lat = parseCoordinate(req.body?.lat, 'lat', -90, 90)
		const lon = parseCoordinate(req.body?.lon, 'lon', -180, 180)

		const geocoderURL = new URL(NOMINATIM_ENDPOINT)
		geocoderURL.searchParams.set('format', 'jsonv2')
		geocoderURL.searchParams.set('lat', String(lat))
		geocoderURL.searchParams.set('lon', String(lon))
		geocoderURL.searchParams.set('addressdetails', '1')

		const response = await fetch(geocoderURL, {
			headers: {
				'User-Agent': NOMINATIM_USER_AGENT,
				Accept: 'application/json'
			}
		})

		if (!response.ok) {
			return res.status(502).json({
				error: 'Reverse geocoding provider failed',
				providerStatus: response.status
			})
		}

		const data = await response.json()
		const address = data.address || {}

		return res.status(200).json({
			lat,
			lon,
			displayName: data.display_name || null,
			address: {
				street: address.road || null,
				houseNumber: address.house_number || null,
				postalCode: address.postcode || null,
				city: address.city || address.town || address.village || null,
				country: address.country || null
			},
			raw: data
		})
	} catch (error) {
		return res.status(400).json({
			error: error.message || 'Invalid request'
		})
	}
})

export default router
