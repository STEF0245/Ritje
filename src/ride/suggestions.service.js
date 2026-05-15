/**
 * @file Ride suggestion filtering and ordering utilities.
 * @brief Filters suggestions by preferences and sorts for display.
 */

import { getDistanceInKm } from './coordinates.util.js'
import {
	estimateDetourForMarker,
	getRouteMetrics
} from './route-metrics.util.js'
import { findMarkersOnRoute } from '../location/location.service.js'

/**
 * @brief Checks if a marker fits within user's detour preferences.
 * @param {object} marker - The marker/suggestion.
 * @param {{detour?: {distance?: number, duration?: number}}} preferences - User limits.
 * @returns {boolean} - True if marker is within all configured limits.
 */
export const checkMarkerFitsPreferences = (marker, preferences = {}) => {
	const detourDistance = Number(marker?.detour?.distance)
	const detourDuration = Number(marker?.detour?.duration)
	const limitDistance = Number(preferences?.detour?.distance)
	const limitDuration = Number(preferences?.detour?.duration)

	if (!Number.isFinite(detourDistance) && !Number.isFinite(detourDuration)) {
		return true
	}

	if (Number.isFinite(limitDistance) && detourDistance > limitDistance) {
		return false
	}

	if (Number.isFinite(limitDuration) && detourDuration > limitDuration) {
		return false
	}

	return true
}

/**
 * @brief Adds preference match metadata to markers.
 * @param {Array<object>} markers - Markers to annotate.
 * @param {object} preferences - User ride preferences.
 * @returns {Array<object>} - Markers with matchesPreferences flag.
 */
export const addPreferenceMatches = (markers, preferences) => {
	return markers.map((marker) => ({
		...marker,
		matchesPreferences: checkMarkerFitsPreferences(marker, preferences)
	}))
}

/**
 * @brief Attaches detour metrics to a marker.
 * @param {object} marker - Original marker.
 * @param {number|null} detourDistanceKm - Extra distance in kilometers.
 * @param {number|null} detourDurationMinutes - Extra duration in minutes.
 * @returns {object} - Marker with detour metadata.
 */
export const addDetourMetrics = (
	marker,
	detourDistanceKm,
	detourDurationMinutes
) => ({
	...marker,
	detour: {
		distance: detourDistanceKm,
		duration: detourDurationMinutes
	}
})

/**
 * @brief Sorts suggestion markers by preference match and detour cost.
 * @param {Array<object>} markers - Unsorted suggestions.
 * @returns {Array<object>} - Markers sorted (preferences first, then distance, then name).
 */
export const sortByPreferenceAndDetour = (markers) => {
	return [...markers].sort((left, right) => {
		// Preference matches come first
		const leftMatches = left?.matchesPreferences ? 1 : 0
		const rightMatches = right?.matchesPreferences ? 1 : 0
		if (leftMatches !== rightMatches) {
			return rightMatches - leftMatches
		}

		// Then sort by shorter detour
		const leftDistance = Number(left?.detour?.distance)
		const rightDistance = Number(right?.detour?.distance)
		if (
			Number.isFinite(leftDistance) &&
			Number.isFinite(rightDistance) &&
			leftDistance !== rightDistance
		) {
			return leftDistance - rightDistance
		}

		// Fallback: alphabetical by name
		const leftTitle = String(left?.title || '')
		const rightTitle = String(right?.title || '')
		return leftTitle.localeCompare(rightTitle, 'nl')
	})
}

/**
 * @brief Builds and orders ride suggestions from markers.
 * @param {{markers?: Array<object>, currentUser?: object, originCoords?: object, rideSettings?: object, baseRoute?: object}} options - Configuration.
 * @returns {Array<object>} - Ordered suggestion markers with detour metadata.
 */
export const buildSuggestions = async ({
	markers = [],
	currentUser = null,
	originCoords = null,
	destinationCoords = null,
	rideSettings = {},
	baseRoute = null
} = {}) => {
	if (!Array.isArray(markers) || markers.length === 0) {
		return []
	}

	const currentUserUid = currentUser?.uid || null
	const route = baseRoute
	const routeMetrics = getRouteMetrics(route)

	// Filter to markers on the route if available
	const routeMarkers = route
		? findMarkersOnRoute(markers, route, destinationCoords)
		: markers

	return sortByPreferenceAndDetour(
		routeMarkers
			// Exclude current user from suggestions
			.filter((marker) => marker?.uid && marker.uid !== currentUserUid)
			.map((marker) => {
				// If no origin/destination, just check preferences
				if (!originCoords || !destinationCoords) {
					return addPreferenceMatches([marker], rideSettings)[0]
				}

				// Calculate detour for this marker
				const detour = estimateDetourForMarker(
					originCoords,
					destinationCoords,
					marker,
					getDistanceInKm,
					routeMetrics
				)

				const markerWithDetour = addDetourMetrics(
					marker,
					detour.detourDistanceKm,
					detour.detourDurationMinutes
				)

				return addPreferenceMatches([markerWithDetour], rideSettings)[0]
			})
	)
}
