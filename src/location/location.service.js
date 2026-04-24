/**
 * @file Geocoding provider orchestration and response normalization.
 * @brief  Supports forward and reverse geocoding through Geoapify.
 * @details  Provides provider selection, rate-limit metadata, coordinate parsing, and normalized responses for forward and reverse geocoding operations.
 */

const GEOAPIFY_ENDPOINT = 'https://api.geoapify.com/v1/geocode/reverse'
const GEOAPIFY_FORWARD_ENDPOINT = 'https://api.geoapify.com/v1/geocode/search'
const GEOAPIFY_ROUTING_ENDPOINT = 'https://api.geoapify.com/v1/routing'

const KNOWN_PROVIDERS = ['geoapify']

/**
 * @brief  Rate limit settings per geocoding provider.
 * @details  Values are read from environment variables with safe defaults and consumed by route-level rate limit middleware.
 * @type {{geoapify: {windowMs: number, max: number}}}
 */
export const RATE_LIMIT_CONFIG = {
	geoapify: {
		windowMs: Number(process.env.GEOAPIFY_RATE_LIMIT_WINDOW_MS || 1000),
		max: Number(process.env.GEOAPIFY_RATE_LIMIT_MAX || 5)
	}
}

/**
 * @brief  Attribution metadata for each geocoding provider.
 * @details  This data is attached to responses and can be used in UI attribution or API headers.
 * @type {{geoapify: {name: string, url: string, requiredCredit: string}}}
 */
export const PROVIDER_ATTRIBUTION = {
	geoapify: {
		name: 'Geoapify',
		url: 'https://www.geoapify.com/',
		requiredCredit: 'Geocoding by Geoapify (OpenStreetMap contributors).'
	}
}

/**
 * @brief  Check whether a geocoding provider is currently usable.
 * @details  Geoapify requires an API key.
 * @param {string} provider - Provider identifier.
 * @returns {boolean} True when the provider can be used.
 */
const isProviderAvailable = (provider) => {
	if (provider === 'geoapify') {
		return Boolean(process.env.GEOAPIFY_API_KEY)
	}
	return false
}

/**
 * @brief  Resolve the active geocoding provider.
 * @details  Honors an explicit `GEOCODING_PROVIDER` override when valid, otherwise uses Geoapify.
 * @returns {'geoapify'} Resolved provider name.
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

	return 'geoapify'
}

/**
 * @brief  Parse and validate a coordinate input.
 * @details  Converts a coordinate to a finite number and validates the allowed range for latitude or longitude.
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
 * @brief  Map provider-specific address objects to the app's address shape.
 * @details  Normalizes naming differences across providers for street, house number, postal code, city, and country fields.
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
 * @brief  Convert a provider coordinate to a consistent 6-decimal representation.
 * @details  Ensures all provider coordinates are returned in the same precision format for storage and UI display consistency.
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
 * @brief  Reverse geocode using Geoapify.
 * @details  Calls the Geoapify reverse endpoint with the configured API key and normalizes the first feature result.
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
 * @brief  Reverse geocode coordinates with the active provider.
 * @details  Selects the provider, executes reverse geocoding, and returns provider attribution along with the result.
 * @param {number} lat - Latitude.
 * @param {number} lon - Longitude.
 * @returns {Promise<{provider: string, attribution: object, result: object|null}>} Reverse geocoding payload.
 */
export const reverseGeocode = async (lat, lon) => {
	const provider = getProvider()
	const attribution = PROVIDER_ATTRIBUTION[provider]
	const result = await reverseWithGeoapify(lat, lon)

	return {
		provider,
		attribution,
		result
	}
}

// ========== Forward geocoding ==========
/**
 * @brief  Forward geocode using Geoapify.
 * @details  Queries Geoapify for a structured match, skips administrative-only boundary results, and returns normalized coordinates.
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
 * @brief  Forward geocode an address with the active provider.
 * @details  Selects the provider, performs forward geocoding, and returns attribution metadata with the normalized result.
 * @param {string} address - Human-readable address query.
 * @param {AbortSignal} signal - Abort signal for request cancellation.
 * @returns {Promise<{provider: string, attribution: object, result: object|null}>} Forward geocoding payload.
 */
export const forwardGeocode = async (address, signal) => {
	const provider = getProvider()
	const attribution = PROVIDER_ATTRIBUTION[provider]
	const result = await forwardWithGeoapify(address, signal)

	return {
		provider,
		attribution,
		result
	}
}

// ========== Common utilities for ride map rendering ==========
export const calculateRoute = async (
	origin,
	destination,
	waypoints = [],
	options = {}
) => {
	const { mode = 'drive', type = 'short' } = options

	const routingUrl = new URL(GEOAPIFY_ROUTING_ENDPOINT)
	routingUrl.searchParams.set('apiKey', process.env.GEOAPIFY_API_KEY)
	routingUrl.searchParams.set(
		'waypoints',
		[
			`${origin.latitude},${origin.longitude}`,
			...waypoints.map((wp) => `${wp.latitude},${wp.longitude}`),
			`${destination.latitude},${destination.longitude}`
		].join('|')
	)
	routingUrl.searchParams.set('mode', mode)
	routingUrl.searchParams.set('type', type)
	routingUrl.searchParams.set('lang', 'nl')
	routingUrl.searchParams.set('format', 'geojson')

	const response = await fetch(routingUrl)
	if (!response.ok) {
		throw new Error(`Routing request failed with status ${response.status}`)
	}

	const data = await response.json()
	return data || null
}

const getRouteLines = (route) => {
	const coordinates = route?.features?.[0]?.geometry?.coordinates

	if (!Array.isArray(coordinates) || coordinates.length === 0) {
		return []
	}

	if (typeof coordinates[0]?.[0] === 'number') {
		return [coordinates]
	}

	return coordinates.filter(
		(line) => Array.isArray(line) && typeof line[0]?.[0] === 'number'
	)
}

const getPointToSegmentDistanceInKm = (point, start, end) => {
	const referenceLatitude = (point.latitude + start[1] + end[1]) / 3
	const latitudeFactor = 110.574
	const longitudeFactor =
		111.32 * Math.cos((referenceLatitude * Math.PI) / 180)

	const project = ([longitude, latitude]) => ({
		x: longitude * longitudeFactor,
		y: latitude * latitudeFactor
	})

	const projectedPoint = project([point.longitude, point.latitude])
	const projectedStart = project(start)
	const projectedEnd = project(end)

	const segmentX = projectedEnd.x - projectedStart.x
	const segmentY = projectedEnd.y - projectedStart.y
	const segmentLengthSquared = segmentX ** 2 + segmentY ** 2
	const segmentLengthKm = Math.hypot(segmentX, segmentY)

	if (segmentLengthSquared === 0) {
		return {
			distance: Math.hypot(
				projectedPoint.x - projectedStart.x,
				projectedPoint.y - projectedStart.y
			),
			projectionRatio: 0,
			clampedProjectionRatio: 0,
			segmentLengthKm
		}
	}

	const pointOffsetX = projectedPoint.x - projectedStart.x
	const pointOffsetY = projectedPoint.y - projectedStart.y
	const projectionRatio =
		(pointOffsetX * segmentX + pointOffsetY * segmentY) /
		segmentLengthSquared
	const clampedProjectionRatio = Math.max(0, Math.min(1, projectionRatio))

	const closestPoint = {
		x: projectedStart.x + clampedProjectionRatio * segmentX,
		y: projectedStart.y + clampedProjectionRatio * segmentY
	}

	return {
		distance: Math.hypot(
			projectedPoint.x - closestPoint.x,
			projectedPoint.y - closestPoint.y
		),
		projectionRatio,
		clampedProjectionRatio,
		segmentLengthKm
	}
}

const buildRouteSegments = (routeLines) => {
	let cumulativeStartKm = 0

	return routeLines.flatMap((line) =>
		line.slice(0, -1).map((start, index) => {
			const end = line[index + 1]
			const segmentLengthKm = getDistanceFromLatLonInKm(
				start[1],
				start[0],
				end[1],
				end[0]
			)

			const segment = {
				start,
				end,
				cumulativeStartKm,
				segmentLengthKm
			}

			cumulativeStartKm += segmentLengthKm
			return segment
		})
	)
}

const getClosestRouteMatch = (point, routeSegments) => {
	let closestMatch = null

	for (const segment of routeSegments) {
		const match = getPointToSegmentDistanceInKm(
			point,
			segment.start,
			segment.end
		)

		if (!closestMatch || match.distance < closestMatch.distance) {
			closestMatch = {
				distance: match.distance,
				progressKm:
					segment.cumulativeStartKm +
					match.clampedProjectionRatio * segment.segmentLengthKm
			}
		}
	}

	return closestMatch
}

const getDestinationPoint = (route, routeSegments, destinationOverride) => {
	if (
		destinationOverride &&
		Number.isFinite(destinationOverride.longitude) &&
		Number.isFinite(destinationOverride.latitude)
	) {
		return {
			longitude: destinationOverride.longitude,
			latitude: destinationOverride.latitude
		}
	}

	const waypointLocation =
		route?.features?.[0]?.properties?.waypoints?.at(-1)?.location

	if (
		Array.isArray(waypointLocation) &&
		waypointLocation.length >= 2 &&
		Number.isFinite(waypointLocation[0]) &&
		Number.isFinite(waypointLocation[1])
	) {
		return {
			longitude: waypointLocation[0],
			latitude: waypointLocation[1]
		}
	}

	const lastSegment = routeSegments.at(-1)
	if (!lastSegment) {
		return null
	}

	return {
		longitude: lastSegment.end[0],
		latitude: lastSegment.end[1]
	}
}

const getOriginPoint = (route, routeSegments) => {
	const waypointLocation =
		route?.features?.[0]?.properties?.waypoints?.[0]?.location

	if (
		Array.isArray(waypointLocation) &&
		waypointLocation.length >= 2 &&
		Number.isFinite(waypointLocation[0]) &&
		Number.isFinite(waypointLocation[1])
	) {
		return {
			longitude: waypointLocation[0],
			latitude: waypointLocation[1]
		}
	}

	const firstSegment = routeSegments[0]
	if (!firstSegment) {
		return null
	}

	return {
		longitude: firstSegment.start[0],
		latitude: firstSegment.start[1]
	}
}

const getProjectedDistanceFromDestinationAxisKm = (
	point,
	originPoint,
	destinationPoint
) => {
	const referenceLatitude =
		(point.latitude + originPoint.latitude + destinationPoint.latitude) / 3
	const latitudeFactor = 110.574
	const longitudeFactor =
		111.32 * Math.cos((referenceLatitude * Math.PI) / 180)

	const toVectorFromDestination = (targetPoint) => ({
		x:
			(targetPoint.longitude - destinationPoint.longitude) *
			longitudeFactor,
		y: (targetPoint.latitude - destinationPoint.latitude) * latitudeFactor
	})

	const destinationToOrigin = toVectorFromDestination(originPoint)
	const destinationToPoint = toVectorFromDestination(point)

	const originMagnitudeKm = Math.hypot(
		destinationToOrigin.x,
		destinationToOrigin.y
	)
	if (originMagnitudeKm === 0) {
		return null
	}

	const dotProduct =
		destinationToOrigin.x * destinationToPoint.x +
		destinationToOrigin.y * destinationToPoint.y

	return dotProduct / originMagnitudeKm
}

const isPointOnOriginSideOfDestination = (
	point,
	originPoint,
	destinationPoint,
	maxBeyondDestinationKm = 0.2
) => {
	if (!originPoint || !destinationPoint) {
		return true
	}

	const projectedDistanceKm = getProjectedDistanceFromDestinationAxisKm(
		point,
		originPoint,
		destinationPoint
	)

	if (!Number.isFinite(projectedDistanceKm)) {
		return true
	}

	return projectedDistanceKm >= -maxBeyondDestinationKm
}

export const findMarkersOnRoute = (
	markers,
	route,
	destinationOverride = null
) => {
	const routeLines = getRouteLines(route)
	if (routeLines.length === 0) {
		return []
	}

	const routeSegments = buildRouteSegments(routeLines)
	if (routeSegments.length === 0) {
		return []
	}

	const originPoint = getOriginPoint(route, routeSegments)
	const destinationPoint = getDestinationPoint(
		route,
		routeSegments,
		destinationOverride
	)
	const destinationMatch = destinationPoint
		? getClosestRouteMatch(destinationPoint, routeSegments)
		: null
	const destinationProgressKm = destinationMatch
		? destinationMatch.progressKm
		: routeSegments.at(-1).cumulativeStartKm +
			routeSegments.at(-1).segmentLengthKm
	const destinationToleranceKm = 0.05

	return markers.filter((marker) => {
		if (
			!Number.isFinite(marker?.latitude) ||
			!Number.isFinite(marker?.longitude)
		) {
			return false
		}

		const closestMatch = getClosestRouteMatch(marker, routeSegments)
		if (!closestMatch || closestMatch.distance > 5) {
			return false
		}

		return (
			isPointOnOriginSideOfDestination(
				marker,
				originPoint,
				destinationPoint
			) &&
			closestMatch.progressKm <=
				destinationProgressKm + destinationToleranceKm
		)
	})
}

export const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
	const deg2rad = (deg) => {
		return deg * (Math.PI / 180)
	}

	const R = 6371 // Radius of the earth in km
	const dLat = deg2rad(lat2 - lat1) // deg2rad below
	const dLon = deg2rad(lon2 - lon1)
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(deg2rad(lat1)) *
			Math.cos(deg2rad(lat2)) *
			Math.sin(dLon / 2) *
			Math.sin(dLon / 2)
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
	const d = R * c // Distance in km
	return d
}
