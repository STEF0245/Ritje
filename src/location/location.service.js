const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/reverse'
const GEOAPIFY_ENDPOINT = 'https://api.geoapify.com/v1/geocode/reverse'
const NOMINATIM_FORWARD_ENDPOINT = 'https://nominatim.openstreetmap.org/search'
const GEOAPIFY_FORWARD_ENDPOINT = 'https://api.geoapify.com/v1/geocode/search'

const NOMINATIM_USER_AGENT =
	process.env.GEOCODER_USER_AGENT ||
	'Ritje/1.0 (reverse geocoding endpoint; contact: admin@example.com)'

const KNOWN_PROVIDERS = ['nominatim', 'geoapify']

export const RATE_LIMIT_CONFIG = {
	nominatim: {
		windowMs: Number(process.env.NOMINATIM_RATE_LIMIT_WINDOW_MS || 1000),
		max: Number(process.env.NOMINATIM_RATE_LIMIT_MAX || 1)
	},
	geoapify: {
		windowMs: Number(process.env.GEOAPIFY_RATE_LIMIT_WINDOW_MS || 1000),
		max: Number(process.env.GEOAPIFY_RATE_LIMIT_MAX || 5)
	}
}

export const PROVIDER_ATTRIBUTION = {
	nominatim: {
		name: 'Nominatim',
		url: 'https://nominatim.org/',
		requiredCredit:
			'Geocoding by Nominatim (OpenStreetMap contributors). See ODbL: https://www.openstreetmap.org/copyright'
	},
	geoapify: {
		name: 'Geoapify',
		url: 'https://www.geoapify.com/',
		requiredCredit: 'Geocoding by Geoapify (OpenStreetMap contributors).'
	}
}

const isProviderAvailable = (provider) => {
	if (provider === 'geoapify') {
		return Boolean(process.env.GEOAPIFY_API_KEY)
	}

	return provider === 'nominatim'
}

export const getProvider = () => {
	const preferredProvider = (
		process.env.GEOCODING_PROVIDER || ''
	).toLowerCase()

	if (KNOWN_PROVIDERS.includes(preferredProvider)) {
		return preferredProvider
	}

	if (isProviderAvailable('geoapify')) {
		return 'geoapify'
	}

	return 'nominatim'
}

export const parseCoordinate = (value, label, min, max) => {
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
	street: address.road || address.street || null,
	houseNumber: address.house_number || address.housenumber || null,
	postalCode: address.postcode || null,
	city:
		address.city ||
		address.town ||
		address.village ||
		address.municipality ||
		null,
	country: address.country || null
})

const parseResultCoordinate = (value, label) => {
	const parsed = Number(value)

	if (!Number.isFinite(parsed)) {
		throw new Error(`Provider returned invalid ${label}`)
	}

	return parsed.toFixed(6) // Round to 6 decimal places for consistency
}

// ========== Reverse geocoding ==========
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
				'Nominatim blocked this server request (403). Set GEOAPIFY_API_KEY or LOCATIONIQ_API_KEY, or use your own Nominatim instance.'
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

const reverseWithGeoapify = async (lat, lon) => {
	const apiKey = process.env.GEOAPIFY_API_KEY

	if (!apiKey) {
		throw new Error('Missing GEOAPIFY_API_KEY for Geoapify provider')
	}

	const geocoderURL = new URL(GEOAPIFY_ENDPOINT)
	geocoderURL.searchParams.set('lat', String(lat))
	geocoderURL.searchParams.set('lon', String(lon))
	geocoderURL.searchParams.set('apiKey', apiKey)

	const response = await fetch(geocoderURL, {
		headers: {
			Accept: 'application/json'
		}
	})

	if (!response.ok) {
		throw new Error(`Geoapify failed with status ${response.status}`)
	}

	const data = await response.json()
	const properties = data?.features?.[0]?.properties

	if (!properties) {
		return null
	}

	return {
		displayName: properties.formatted || null,
		address: mapAddress(properties),
		raw: properties
	}
}

export const reverseGeocode = async (lat, lon) => {
	const provider = getProvider()
	const attribution = PROVIDER_ATTRIBUTION[provider]

	let result

	if (provider === 'geoapify') {
		result = await reverseWithGeoapify(lat, lon)
	} else {
		result = await reverseWithNominatim(lat, lon)
	}

	return {
		provider,
		attribution,
		result
	}
}

// ========== Forward geocoding ==========
const forwardWithNominatim = async (address) => {
	const geocoderURL = new URL(NOMINATIM_FORWARD_ENDPOINT)
	geocoderURL.searchParams.set('format', 'jsonv2')
	geocoderURL.searchParams.set('q', address)
	geocoderURL.searchParams.set('limit', '1')
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
				'Nominatim blocked this server request (403). Set GEOAPIFY_API_KEY or LOCATIONIQ_API_KEY, or use your own Nominatim instance.'
			)
		}

		throw new Error(`Nominatim failed with status ${response.status}`)
	}

	const data = await response.json()
	const firstMatch = Array.isArray(data) ? data[0] : null

	if (!firstMatch) {
		return null
	}

	return {
		lat: parseResultCoordinate(firstMatch.lat, 'latitude'),
		lon: parseResultCoordinate(firstMatch.lon, 'longitude'),
		raw: firstMatch
	}
}

const forwardWithGeoapify = async (address) => {
	const apiKey = process.env.GEOAPIFY_API_KEY

	if (!apiKey) {
		throw new Error('Missing GEOAPIFY_API_KEY for Geoapify provider')
	}

	const geocoderURL = new URL(GEOAPIFY_FORWARD_ENDPOINT)
	geocoderURL.searchParams.set('text', address)
	geocoderURL.searchParams.set('limit', '1')
	geocoderURL.searchParams.set('apiKey', apiKey)

	const response = await fetch(geocoderURL, {
		headers: {
			Accept: 'application/json'
		}
	})

	if (!response.ok) {
		throw new Error(`Geoapify failed with status ${response.status}`)
	}

	const data = await response.json()
	const firstFeature = data?.features?.[0]
	const properties = firstFeature?.properties

	if (!properties) {
		return null
	}

	const latCandidate =
		properties.lat ?? firstFeature?.geometry?.coordinates?.[1]
	const lonCandidate =
		properties.lon ?? firstFeature?.geometry?.coordinates?.[0]

	return {
		lat: parseResultCoordinate(latCandidate, 'latitude'),
		lon: parseResultCoordinate(lonCandidate, 'longitude'),
		raw: properties
	}
}

export const forwardGeocode = async (address) => {
	const provider = getProvider()
	const attribution = PROVIDER_ATTRIBUTION[provider]

	let result
	if (provider === 'geoapify') {
		result = await forwardWithGeoapify(address)
	} else {
		result = await forwardWithNominatim(address)
	}

	return {
		provider,
		attribution,
		result
	}
}
