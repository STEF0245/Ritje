/**
 * @file Geocoding provider orchestration and response normalization.
 * @brief  Summary: Supports forward and reverse geocoding through Nominatim and Geoapify.
 * @details  Details: Provides provider selection, rate-limit metadata, coordinate parsing, and normalized responses for both forward and reverse geocoding operations.
 */

const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/reverse'
const GEOAPIFY_ENDPOINT = 'https://api.geoapify.com/v1/geocode/reverse'
const NOMINATIM_FORWARD_ENDPOINT = 'https://nominatim.openstreetmap.org/search'
const GEOAPIFY_FORWARD_ENDPOINT = 'https://api.geoapify.com/v1/geocode/search'

const NOMINATIM_USER_AGENT =
	process.env.GEOCODER_USER_AGENT ||
	'Ritje/1.0 (reverse geocoding endpoint; contact: admin@example.com)'

const KNOWN_PROVIDERS = ['nominatim', 'geoapify']

/**
 * @brief  Summary: Rate limit settings per geocoding provider.
 * @details  Details: Values are read from environment variables with safe defaults and consumed by route-level rate limit middleware.
 * @type {{nominatim: {windowMs: number, max: number}, geoapify: {windowMs: number, max: number}}}
 */
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

/**
 * @brief  Summary: Attribution metadata for each geocoding provider.
 * @details  Details: This data is attached to responses and can be used in UI attribution or API headers.
 * @type {{nominatim: {name: string, url: string, requiredCredit: string}, geoapify: {name: string, url: string, requiredCredit: string}}}
 */
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

/**
 * @brief  Summary: Check whether a geocoding provider is currently usable.
 * @details  Details: Geoapify requires an API key while Nominatim is treated as available by default.
 * @param {string} provider - Provider identifier.
 * @returns {boolean} True when the provider can be used.
 */
const isProviderAvailable = (provider) => {
	if (provider === 'geoapify') {
		return Boolean(process.env.GEOAPIFY_API_KEY)
	}

	return provider === 'nominatim'
}

/**
 * @brief  Summary: Resolve the active geocoding provider.
 * @details  Details: Honors an explicit `GEOCODING_PROVIDER` override when valid, otherwise prefers Geoapify when configured and falls back to Nominatim.
 * @returns {'nominatim'|'geoapify'} Resolved provider name.
 */
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

/**
 * @brief  Summary: Parse and validate a coordinate input.
 * @details  Details: Converts a coordinate to a finite number and validates the allowed range for latitude or longitude.
 * @param {unknown} value - Incoming coordinate value.
 * @param {string} label - Coordinate label used in error messages.
 * @param {number} min - Minimum allowed value.
 * @param {number} max - Maximum allowed value.
 * @returns {number} Parsed coordinate value.
 * @throws {Error} Throws when the coordinate is invalid or out of range.
 */
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

/**
 * @brief  Summary: Map provider-specific address objects to the app's address shape.
 * @details  Details: Normalizes naming differences across providers for street, house number, postal code, city, and country fields.
 * @param {object} address - Raw provider address payload.
 * @returns {{street: string|null, houseNumber: string|null, postalCode: string|null, city: string|null, country: string|null}} Normalized address object.
 */
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

/**
 * @brief  Summary: Convert a provider coordinate to a consistent 6-decimal representation.
 * @details  Details: Ensures all provider coordinates are returned in the same precision format for storage and UI display consistency.
 * @param {unknown} value - Raw coordinate value from the provider.
 * @param {string} label - Coordinate label used in error messages.
 * @returns {string} Normalized coordinate string.
 * @throws {Error} Throws when the provider returns an invalid coordinate.
 */
const parseResultCoordinate = (value, label) => {
	const parsed = Number(value)

	if (!Number.isFinite(parsed)) {
		throw new Error(`Provider returned invalid ${label}`)
	}

	return parsed.toFixed(6)
}

// ========== Reverse geocoding ==========
/**
 * @brief  Summary: Reverse geocode using Nominatim.
 * @details  Details: Sends a reverse geocoding request, validates the response, and normalizes the returned address payload.
 * @param {number} lat - Latitude.
 * @param {number} lon - Longitude.
 * @returns {Promise<{displayName: string, address: object, raw: object}|null>} Normalized result or null when no match is found.
 * @throws {Error} Throws when the provider request fails.
 */
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

/**
 * @brief  Summary: Reverse geocode using Geoapify.
 * @details  Details: Calls the Geoapify reverse endpoint with the configured API key and normalizes the first feature result.
 * @param {number} lat - Latitude.
 * @param {number} lon - Longitude.
 * @returns {Promise<{displayName: string|null, address: object, raw: object}|null>} Normalized result or null when no match is found.
 * @throws {Error} Throws when configuration is missing or the provider request fails.
 */
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

/**
 * @brief  Summary: Reverse geocode coordinates with the active provider.
 * @details  Details: Selects the provider, executes reverse geocoding, and returns provider attribution along with the result.
 * @param {number} lat - Latitude.
 * @param {number} lon - Longitude.
 * @returns {Promise<{provider: string, attribution: object, result: object|null}>} Reverse geocoding payload.
 */
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
/**
 * @brief  Summary: Forward geocode using Nominatim.
 * @details  Details: Queries Nominatim with a free-form address and returns the first normalized coordinate match.
 * @param {string} address - Human-readable address query.
 * @param {AbortSignal} signal - Abort signal for request cancellation.
 * @returns {Promise<{lat: string, lon: string, raw: object}|null>} Normalized match or null when no results exist.
 * @throws {Error} Throws when the provider request fails.
 */
const forwardWithNominatim = async (address, signal) => {
	const geocoderURL = new URL(NOMINATIM_FORWARD_ENDPOINT)
	geocoderURL.searchParams.set('format', 'jsonv2')
	geocoderURL.searchParams.set('q', address)
	geocoderURL.searchParams.set('limit', '1')
	geocoderURL.searchParams.set('addressdetails', '1')

	const response = await fetch(geocoderURL, {
		headers: {
			'User-Agent': NOMINATIM_USER_AGENT,
			Accept: 'application/json'
		},
		signal
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

/**
 * @brief  Summary: Forward geocode using Geoapify.
 * @details  Details: Queries Geoapify for a structured match, skips administrative-only boundary results, and returns normalized coordinates.
 * @param {string} address - Human-readable address query.
 * @param {AbortSignal} signal - Abort signal for request cancellation.
 * @returns {Promise<{lat: string, lon: string, raw: object}|null>} Normalized match or null when no suitable result exists.
 * @throws {Error} Throws when configuration is missing or the provider request fails.
 */
const forwardWithGeoapify = async (address, signal) => {
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
		},
		signal
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

	if (
		properties.category === 'boundary' &&
		properties.type === 'administrative'
	) {
		return null
	}

	const latCandidate =
		properties.lat ?? firstFeature?.geometry?.coordinates?.[1]
	const lonCandidate =
		properties.lon ?? firstFeature?.geometry?.coordinates?.[0]

	if (latCandidate == null || lonCandidate == null) {
		return null
	}

	return {
		lat: parseResultCoordinate(latCandidate, 'latitude'),
		lon: parseResultCoordinate(lonCandidate, 'longitude'),
		raw: properties
	}
}

/**
 * @brief  Summary: Forward geocode an address with the active provider.
 * @details  Details: Selects the provider, performs forward geocoding, and returns attribution metadata with the normalized result.
 * @param {string} address - Human-readable address query.
 * @param {AbortSignal} signal - Abort signal for request cancellation.
 * @returns {Promise<{provider: string, attribution: object, result: object|null}>} Forward geocoding payload.
 */
export const forwardGeocode = async (address, signal) => {
	const provider = getProvider()
	const attribution = PROVIDER_ATTRIBUTION[provider]

	let result
	if (provider === 'geoapify') {
		result = await forwardWithGeoapify(address, signal)
	} else {
		result = await forwardWithNominatim(address, signal)
	}

	return {
		provider,
		attribution,
		result
	}
}
