/**
 * @file Route metrics and estimation utilities.
 * @brief Extracts distance/duration metrics from routes and estimates travel times.
 */

/**
 * @brief Extracts normalized distance and duration from a route response.
 * @details Supports multiple GeoJSON property shapes for flexibility.
 * @param {object} route - Route payload from routing API.
 * @returns {{distanceKm: number, durationMinutes: number}|null} - Metrics or null if unavailable.
 */
export const getRouteMetrics = (route) => {
	const feature = route?.features?.[0] || null
	const properties = feature?.properties || route?.properties || route || null
	const distanceMeters = Number(
		properties?.distance ??
			properties?.total_distance ??
			properties?.summary?.distance
	)
	const durationSeconds = Number(
		properties?.time ?? properties?.total_time ?? properties?.summary?.time
	)

	if (!Number.isFinite(distanceMeters) || !Number.isFinite(durationSeconds)) {
		return null
	}

	return {
		distanceKm: distanceMeters / 1000,
		durationMinutes: durationSeconds / 60
	}
}

/**
 * @brief Estimates travel time in minutes based on distance and reference metrics.
 * @param {number} distanceKm - Distance in kilometers.
 * @param {{distanceKm?: number, durationMinutes?: number}|null} referenceMetrics - Reference route for ratio.
 * @returns {number} - Estimated travel time in minutes.
 */
export const estimateMinutesFromDistance = (
	distanceKm,
	referenceMetrics = null
) => {
	const refDistanceKm = Number(referenceMetrics?.distanceKm)
	const refDurationMinutes = Number(referenceMetrics?.durationMinutes)

	if (refDistanceKm > 0) {
		const minutesPerKm = refDurationMinutes / refDistanceKm
		if (Number.isFinite(minutesPerKm) && minutesPerKm > 0) {
			return distanceKm * minutesPerKm
		}
	}

	// Conservative fallback: 1.5 minutes per kilometer
	return distanceKm * 1.5
}

/**
 * @brief Calculates detour distance and time for a pickup location.
 * @details Compares direct route vs. route through the pickup marker.
 * @param {{latitude: number, longitude: number}} origin - Starting point.
 * @param {{latitude: number, longitude: number}} destination - Final destination.
 * @param {{latitude: number, longitude: number}} marker - Pickup marker.
 * @param {{distanceKm?: number, durationMinutes?: number}|null} referenceMetrics - Reference route.
 * @returns {{detourDistanceKm: number, detourDurationMinutes: number}} - Detour costs.
 */
export const estimateDetourForMarker = (
	origin,
	destination,
	marker,
	getDistance,
	referenceMetrics
) => {
	const directDistance = getDistance(origin, destination)
	const routeViaMarkerDistance =
		getDistance(origin, marker) + getDistance(marker, destination)
	const detourDistanceKm = Math.max(
		0,
		routeViaMarkerDistance - directDistance
	)
	const detourDurationMinutes = estimateMinutesFromDistance(
		detourDistanceKm,
		referenceMetrics
	)

	return {
		detourDistanceKm,
		detourDurationMinutes
	}
}
