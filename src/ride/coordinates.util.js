/**
 * @file Coordinate and geometry utilities for ride calculations.
 * @brief Handles coordinate normalization, distance calculations, and spatial operations.
 */

import { getDistanceFromLatLonInKm } from '../location/location.service.js'

/**
 * @brief Normalizes a point to ensure it has valid latitude and longitude.
 * @param {object} point - Object with latitude/longitude or lat/lon properties.
 * @returns {{latitude: number, longitude: number}|null} - Normalized point or null if invalid.
 */
export const normalizeCoordinates = (point) => {
	const latitude = Number(point?.latitude ?? point?.lat)
	const longitude = Number(point?.longitude ?? point?.lon)

	if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
		return null
	}

	return { latitude, longitude }
}

/**
 * @brief Checks if a point has valid latitude and longitude.
 * @param {object} point - The point to validate.
 * @returns {boolean} - True if coordinates are valid and finite.
 */
export const hasValidCoordinates = (point) => {
	const latitude = Number(point?.latitude)
	const longitude = Number(point?.longitude)
	return Number.isFinite(latitude) && Number.isFinite(longitude)
}

/**
 * @brief Calculates distance in kilometers between two coordinates using Haversine formula.
 * @param {{latitude: number, longitude: number}} start - Starting coordinates.
 * @param {{latitude: number, longitude: number}} end - Ending coordinates.
 * @returns {number} - Distance in kilometers, or Infinity if invalid.
 */
export const getDistanceInKm = (start, end) => {
	const toRadians = (degrees) => degrees * (Math.PI / 180)
	const earthRadiusKm = 6371

	const startLatitude = Number(start?.latitude)
	const startLongitude = Number(start?.longitude)
	const endLatitude = Number(end?.latitude)
	const endLongitude = Number(end?.longitude)

	if (
		!Number.isFinite(startLatitude) ||
		!Number.isFinite(startLongitude) ||
		!Number.isFinite(endLatitude) ||
		!Number.isFinite(endLongitude)
	) {
		return Number.POSITIVE_INFINITY
	}

	const deltaLatitude = toRadians(endLatitude - startLatitude)
	const deltaLongitude = toRadians(endLongitude - startLongitude)

	const a =
		Math.sin(deltaLatitude / 2) ** 2 +
		Math.cos(toRadians(startLatitude)) *
			Math.cos(toRadians(endLatitude)) *
			Math.sin(deltaLongitude / 2) ** 2
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

	return earthRadiusKm * c
}

/**
 * @brief Reorders waypoints using a greedy nearest-neighbor algorithm.
 * @param {{latitude: number, longitude: number}} origin - Starting point.
 * @param {Array<{latitude: number, longitude: number}>} waypoints - Points to order.
 * @returns {Array<object>} - Waypoints in optimized order.
 */
export const optimizeWaypointOrder = (origin, waypoints = []) => {
	if (!origin || !Array.isArray(waypoints) || waypoints.length <= 1)
		return waypoints

	const remaining = waypoints.slice()
	const ordered = []
	let current = { latitude: origin.latitude, longitude: origin.longitude }

	while (remaining.length > 0) {
		let bestIndex = 0
		let bestDist = Number.POSITIVE_INFINITY

		for (let i = 0; i < remaining.length; i++) {
			const w = remaining[i]
			const d = getDistanceFromLatLonInKm(
				current.latitude,
				current.longitude,
				w.latitude,
				w.longitude
			)
			if (d < bestDist) {
				bestDist = d
				bestIndex = i
			}
		}

		const next = remaining.splice(bestIndex, 1)[0]
		ordered.push(next)
		current = { latitude: next.latitude, longitude: next.longitude }
	}

	return ordered
}

/**
 * @brief Computes the average center point of markers.
 * @param {Array<{latitude: number, longitude: number}>} markers - Markers to center.
 * @returns {{latitude: number, longitude: number}|null} - Center point or null if no valid markers.
 */
export const computeMapCenter = (markers = []) => {
	if (!Array.isArray(markers) || markers.length === 0) {
		return null
	}

	const validMarkers = markers.filter(
		(marker) =>
			Number.isFinite(marker.latitude) &&
			Number.isFinite(marker.longitude)
	)

	if (validMarkers.length === 0) {
		return null
	}

	const latitude =
		validMarkers.reduce((sum, marker) => sum + marker.latitude, 0) /
		validMarkers.length
	const longitude =
		validMarkers.reduce((sum, marker) => sum + marker.longitude, 0) /
		validMarkers.length

	return { latitude, longitude }
}
