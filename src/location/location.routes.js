import express from 'express'

const router = express.Router()

const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/reverse'
const LOCATIONIQ_ENDPOINT = 'https://us1.locationiq.com/v1/reverse'
const NOMINATIM_USER_AGENT =
	process.env.GEOCODER_USER_AGENT ||
	'Ritje/1.0 (reverse geocoding endpoint; contact: admin@example.com)'

const getProvider = () => {
	if (process.env.LOCATIONIQ_API_KEY) {
		return 'locationiq'
	}

	return 'nominatim'
}

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

const mapAddress = (address = {}) => ({
	street: address.road || null,
	houseNumber: address.house_number || null,
	postalCode: address.postcode || null,
	city: address.city || address.town || address.village || null,
	country: address.country || null
})

const reverseWithNominatim = async (lat, lon) => {
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
		if (response.status === 403) {
			throw new Error(
				'Nominatim blocked this server request (403). Set LOCATIONIQ_API_KEY to use LocationIQ instead.'
			)
		}

		throw new Error(`Nominatim failed with status ${response.status}`)
	}

	const data = await response.json()

	if (!data?.display_name) {
		return null
	}

	return {
		displayName: data.display_name,
		address: mapAddress(data.address),
		raw: data
	}
}

const reverseWithLocationIQ = async (lat, lon) => {
	const apiKey = process.env.LOCATIONIQ_API_KEY

	if (!apiKey) {
		throw new Error('Missing LOCATIONIQ_API_KEY for LocationIQ provider')
	}

	const geocoderURL = new URL(LOCATIONIQ_ENDPOINT)
	geocoderURL.searchParams.set('key', apiKey)
	geocoderURL.searchParams.set('lat', String(lat))
	geocoderURL.searchParams.set('lon', String(lon))
	geocoderURL.searchParams.set('format', 'json')

	const response = await fetch(geocoderURL, {
		headers: {
			Accept: 'application/json'
		}
	})

	if (!response.ok) {
		throw new Error(`LocationIQ failed with status ${response.status}`)
	}

	const data = await response.json()

	if (!data?.display_name) {
		return null
	}

	return {
		displayName: data.display_name,
		address: mapAddress(data.address),
		raw: data
	}
}

router.post('/reverse-geocode', async (req, res) => {
	try {
		const lat = parseCoordinate(req.body?.lat, 'lat', -90, 90)
		const lon = parseCoordinate(req.body?.lon, 'lon', -180, 180)
		const provider = getProvider()
		const result =
			provider === 'locationiq'
				? await reverseWithLocationIQ(lat, lon)
				: await reverseWithNominatim(lat, lon)

		if (!result) {
			return res.status(404).json({
				error: 'No address found for provided coordinates'
			})
		}

		return res.status(200).json({
			lat,
			lon,
			provider,
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
})

export default router
