/**
 * @file Ride controller for handling ride page requests.
 * @brief Provides the handlers for rendering the ride page and fetching ride suggestions.
 * @details Routes requests to appropriate service functions and returns payloads for rendering.
 */

import config from '../config.js'
import { respondWithNotification } from '../utils/notification.util.js'
import {
	calculateRoute,
	findMarkersOnRoute
} from '../location/location.service.js'
import {
	buildDaySchedules,
	getNextOccurrence,
	isValidOccurrence
} from '../utils/schedule.util.js'

// Validation & normalization
import {
	toNonNegativeInteger,
	normalizePassengers,
	isValidDayAndHour
} from './validation.util.js'

// Coordinate utilities
import {
	normalizeCoordinates,
	hasValidCoordinates,
	optimizeWaypointOrder,
	computeMapCenter
} from './coordinates.util.js'

// Route utilities
import {
	getRouteMetrics,
	estimateDetourForMarker
} from './route-metrics.util.js'
import {
	getBaseRoute,
	calculateRouteWithWaypoints,
	buildRouteCacheKey
} from './route-cache.service.js'

// Ride utilities
import {
	getRideStatus,
	isRideCanceled,
	buildRideRecordKey
} from './ride-status.util.js'
import {
	getRideRecord,
	hasAnotherActiveRide,
	saveRide,
	cancelRide,
	updatePassenger
} from './ride-database.service.js'

// User & marker utilities
import {
	getAllUsers,
	buildMarkers,
	filterUsersBySchedule,
	resolveOriginCoordinates
} from './user-markers.service.js'

// Suggestions
import { buildSuggestions } from './suggestions.service.js'

// Email
import { sendInvitationEmails, getHourLabel } from './ride-email.service.js'

// Settings
import { buildRideSettings } from './ride-settings.util.js'

// Invitations
import { getInvitationRides } from './invitation-rides.service.js'

const SCHOOL_DESTINATION = normalizeCoordinates(config.school?.coords)

/**
 * @brief Assembles the full ride page payload for rendering and AJAX suggestions.
 * @param {object} req - Express request object.
 * @param {number} day - Selected weekday index.
 * @param {number} hour - Selected schedule slot.
 * @returns {Promise<object>} Render payload with map markers, route data, and suggestions.
 */
export const buildRidePayload = async (req, day, hour) => {
	const users = await getAllUsers()
	const filteredUsers = filterUsersBySchedule(users, req.user, day, hour)
	const mapMarkers = buildMarkers(filteredUsers, req.user?.uid)
	const mapCenter = computeMapCenter(mapMarkers)
	const rideSettings = buildRideSettings(req.user?.metadata?.preferences)
	const currentUserUid = req.user?.uid
	const currentUserMarker = mapMarkers.find((m) => m.uid === currentUserUid)
	const originCoords = resolveOriginCoordinates(req)

	const baseRoute = originCoords
		? await getBaseRoute(originCoords, SCHOOL_DESTINATION)
		: null
	const suggestions = await buildSuggestions({
		markers: mapMarkers,
		currentUser: req.user,
		originCoords,
		destinationCoords: SCHOOL_DESTINATION,
		rideSettings,
		baseRoute
	})

	const currentRideRecord = await getRideRecord(req.user?.uid, day, hour)
	const currentRide =
		currentRideRecord && !isRideCanceled(currentRideRecord)
			? currentRideRecord
			: null
	const invitationRides = await getInvitationRides(
		req.user?.uid,
		day,
		hour,
		users
	)
	const displayRoute = currentRide?.route || baseRoute
	const schedule = req.user?.metadata?.schedule || {}
	const { daySchedules, hasAnySchedule } = buildDaySchedules(schedule)
	const selectedKey = String(currentRide?.day || day || '')
	const selectedValue = String(currentRide?.hour || hour || '')

	return {
		mapMarkers: currentUserMarker ? [currentUserMarker] : [],
		rideSettings,
		mapCenter,
		route: displayRoute,
		activeRide: !!currentRide,
		invitationRides,
		suggestions,
		day,
		hour,
		daySchedules,
		hasAnySchedule,
		selectedKey,
		selectedValue
	}
}

/**
 * @brief Common render logic for scheduled ride pages.
 * @param {object} options - Render configuration.
 * @returns {Promise<object>} Rendered response or notification.
 */
const renderRidePage = async ({
	req,
	res,
	view,
	title,
	noScheduleResponse,
	errorResponse
}) => {
	try {
		const day = toNonNegativeInteger(req.params?.day)
		const hour = toNonNegativeInteger(req.params?.hour)

		// If no day/hour provided, find next and redirect
		if (
			day === null ||
			hour === null ||
			!isValidOccurrence(req.user?.metadata?.schedule, day, hour)
		) {
			return respondWithNotification(res, noScheduleResponse)
		}

		const payload = await buildRidePayload(req, day, hour)
		return res.render(view, { title, ...payload })
	} catch (error) {
		console.error(`Error rendering ${view} page:`, error)
		return respondWithNotification(res, errorResponse)
	}
}

export const redirectToRidePage = async (req, res) => {
	try {
		const nextOccurrence = getNextOccurrence(
			req.user?.metadata?.schedule || {}
		)
		if (nextOccurrence) {
			return res.redirect(
				`/ride/${nextOccurrence.day}/${nextOccurrence.hour}`
			)
		}
		return respondWithNotification(res, {
			type: 'info',
			message: 'Je hebt geen rooster ingesteld.',
			status: 200,
			view: 'ride',
			title: 'Ritten',
			extra: {
				mapMarkers: [],
				route: null,
				suggestions: [],
				activeRide: false,
				invitationRides: [],
				rideSettings: {},
				daySchedules: [],
				hasAnySchedule: false,
				selectedKey: '',
				selectedValue: ''
			}
		})
	} catch (error) {
		console.error('Error redirecting to ride page:', error)
		return respondWithNotification(res, {
			type: 'error',
			message:
				'Er is een fout opgetreden bij het laden van de ritpagina. Probeer het later opnieuw.',
			status: 500,
			view: 'ride',
			title: 'Ritten',
			extra: {
				mapMarkers: [],
				route: null,
				suggestions: [],
				activeRide: false,
				invitationRides: [],
				rideSettings: {},
				daySchedules: [],
				hasAnySchedule: false,
				selectedKey: '',
				selectedValue: ''
			}
		})
	}
}

/**
 * @brief Renders the ride page with the current user's route and suggestions.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @returns {Promise<object>} Rendered ride page or error notification.
 */
export const getRidePage = async (req, res) => {
	return renderRidePage({
		req,
		res,
		view: 'ride',
		title: 'Ritten',
		noScheduleResponse: {
			type: 'info',
			message: 'Je hebt geen rooster ingesteld.',
			status: 200,
			view: 'ride',
			title: 'Ritten',
			extra: {
				mapMarkers: [],
				route: null,
				suggestions: [],
				activeRide: false,
				invitationRides: [],
				rideSettings: {},
				daySchedules: [],
				hasAnySchedule: false,
				selectedKey: '',
				selectedValue: ''
			}
		},
		errorResponse: {
			type: 'error',
			message:
				'Er is een fout opgetreden bij het laden van de ritpagina. Probeer het later opnieuw.',
			status: 500,
			view: 'ride',
			title: 'Ritten',
			extra: {
				mapMarkers: [],
				route: null,
				suggestions: [],
				activeRide: false,
				invitationRides: [],
				rideSettings: {},
				daySchedules: [],
				hasAnySchedule: false,
				selectedKey: '',
				selectedValue: ''
			}
		}
	})
}

export const getRideEditPage = async (req, res) => {
	return renderRidePage({
		req,
		res,
		view: 'ride_edit',
		title: 'Rit bewerken',
		noScheduleResponse: {
			type: 'info',
			message: 'Je hebt geen rooster ingesteld.',
			status: 200,
			view: 'ride_edit',
			title: 'Rit bewerken',
			extra: {
				mapMarkers: [],
				route: null,
				suggestions: [],
				activeRide: false,
				invitationRides: [],
				rideSettings: {},
				daySchedules: [],
				hasAnySchedule: false,
				selectedKey: '',
				selectedValue: ''
			}
		},
		errorResponse: {
			type: 'error',
			message:
				'Er is een fout opgetreden bij het laden van de ritpagina. Probeer het later opnieuw.',
			status: 500,
			view: 'ride_edit',
			title: 'Rit bewerken',
			extra: {
				mapMarkers: [],
				route: null,
				suggestions: [],
				activeRide: false,
				invitationRides: [],
				rideSettings: {},
				daySchedules: [],
				hasAnySchedule: false,
				selectedKey: '',
				selectedValue: ''
			}
		}
	})
}

/**
 * @brief Cancels a ride for the current user.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @returns {Promise<object>} Success or error notification.
 */
export const cancelRideAction = async (req, res) => {
	try {
		const day = Number(req.params.day)
		const hour = Number(req.params.hour)
		const ride = await cancelRide(req.user?.uid, day, hour)

		if (!ride) {
			return respondWithNotification(res, {
				type: 'info',
				label: 'Rit niet gevonden',
				message: 'Er was geen actieve rit om te annuleren.',
				redirectTo: `/ride/${day}/${hour}`
			})
		}

		return respondWithNotification(res, {
			type: 'success',
			label: 'Rit geannuleerd',
			message: 'De rit is geannuleerd en kan opnieuw worden aangemaakt.',
			redirectTo: `/ride/${day}/${hour}`
		})
	} catch (error) {
		console.error('Error canceling ride:', error)
		return respondWithNotification(res, {
			type: 'error',
			label: 'Annuleren mislukt',
			message:
				'De rit kon niet worden geannuleerd. Probeer het later opnieuw.',
			redirectTo: '/ride'
		})
	}
}

/**
 * @brief Handles passenger response to ride invitation.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @returns {Promise<object>} Success or error notification.
 */
export const respondToRideAction = async (req, res) => {
	try {
		const day = Number(req.params.day)
		const hour = Number(req.params.hour)
		const driverUid = String(req.body?.driverUid || '')
		const response = String(req.body?.response || '')

		if (!driverUid) {
			return respondWithNotification(res, {
				type: 'error',
				label: 'Ongeldige rit',
				message: 'Er ontbreekt een rit om op te reageren.',
				redirectTo: `/ride/${day}/${hour}`
			})
		}

		const ride = await updatePassenger(
			driverUid,
			day,
			hour,
			req.user?.uid,
			response
		)

		if (!ride) {
			return respondWithNotification(res, {
				type: 'info',
				label: 'Geen uitnodiging',
				message:
					'Deze rit is niet meer beschikbaar of je bent geen genodigde.',
				redirectTo: `/ride/${day}/${hour}`
			})
		}

		return respondWithNotification(res, {
			type: response === 'accepted' ? 'success' : 'info',
			label:
				response === 'accepted' ? 'Rit geaccepteerd' : 'Rit geweigerd',
			message:
				response === 'accepted'
					? 'Je deelname aan de rit is bevestigd.'
					: 'Je hebt de rituitnodiging geweigerd.',
			redirectTo: `/ride/${day}/${hour}`
		})
	} catch (error) {
		console.error('Error responding to ride invitation:', error)
		return respondWithNotification(res, {
			type: 'error',
			label: 'Reactie mislukt',
			message:
				'Je reactie kon niet worden opgeslagen. Probeer het later opnieuw.',
			redirectTo: '/ride'
		})
	}
}

/**
 * @brief Calculates and returns a route with selected suggestions.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @returns {Promise<object>} JSON response with route and markers.
 */
export const calculateRouteWithSuggestions = async (req, res) => {
	try {
		const originCoords = resolveOriginCoordinates(req)
		if (!originCoords) {
			return res.status(400).json({
				error: 'Ongeldige parameters: "lat" en "lon" moeten geldige coördinaten bevatten.'
			})
		}

		const baseRoute = await getBaseRoute(originCoords, SCHOOL_DESTINATION)
		if (!baseRoute) {
			return res.status(500).json({
				error: 'Er is een fout opgetreden bij het berekenen van de route. Probeer het later opnieuw.'
			})
		}

		const users = await getAllUsers()
		const mapMarkers = buildMarkers(users, req.user?.uid)
		const currentUserMarker = mapMarkers.find(
			(m) => m.uid === req.user?.uid
		)
		const rideSettings = buildRideSettings(req.user?.metadata?.preferences)
		const suggestions = await buildSuggestions({
			markers: mapMarkers,
			currentUser: req.user,
			originCoords,
			destinationCoords: SCHOOL_DESTINATION,
			rideSettings,
			baseRoute
		})

		const selectedPassengers = new Set(
			normalizePassengers(req.body?.passengers)
		)
		const selectedSuggestions =
			selectedPassengers.size > 0
				? suggestions.filter((s) =>
						selectedPassengers.has(String(s?.uid))
					)
				: suggestions

		const seatLimit = rideSettings?.seats?.total || 1
		if (selectedSuggestions.length > seatLimit) {
			return res.status(400).json({
				error: `Je kunt maximaal ${seatLimit} personen selecteren.`
			})
		}

		const cacheKey = buildRouteCacheKey(
			originCoords,
			selectedSuggestions.map((s) => s.uid)
		)
		let routeWithSuggestions = baseRoute

		if (selectedSuggestions.length > 0) {
			const optimizedWaypoints = optimizeWaypointOrder(
				originCoords,
				selectedSuggestions
			)
			routeWithSuggestions = await calculateRouteWithWaypoints(
				originCoords,
				SCHOOL_DESTINATION,
				optimizedWaypoints,
				cacheKey
			)
		}

		return res.json({
			route: routeWithSuggestions,
			suggestions: currentUserMarker
				? [currentUserMarker, ...selectedSuggestions]
				: selectedSuggestions,
			cached: false
		})
	} catch (error) {
		console.error('Error calculating route with suggestions:', error)
		return res.status(500).json({
			error: 'Er is een fout opgetreden bij het berekenen van de route. Probeer het later opnieuw.'
		})
	}
}

/**
 * @brief Saves a new ride route to the database.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @returns {Promise<object>} JSON or redirect response.
 */
export const saveRideRoute = async (req, res) => {
	try {
		const user = req.user
		const userUid = String(user?.uid || '')
		if (!userUid) {
			return res.status(401).json({
				error: 'Je moet aangemeld zijn om een rit op te slaan.'
			})
		}

		const day = toNonNegativeInteger(req.body?.day)
		const hour = toNonNegativeInteger(req.body?.hour)
		if (day === null || hour === null || !isValidDayAndHour(day, hour)) {
			return res.status(400).json({
				error: 'Ongeldige parameters: "day" en "hour" moeten geldige roosterwaarden bevatten.'
			})
		}

		const route = req.body?.route
		if (!route || typeof route !== 'object') {
			return res.json({ saved: false, ignored: true })
		}

		const shortRideKey = `${day}_${hour}`
		if (await hasAnotherActiveRide(userUid, day, hour, shortRideKey)) {
			return res.status(409).json({
				error: 'Je hebt al een actieve rit. Annuleer die eerst voordat je een nieuwe rit opslaat.'
			})
		}

		const markers = Array.isArray(req.body?.markers) ? req.body.markers : []
		const passengers = normalizePassengers(req.body?.passengers)
		const nowIso = new Date().toISOString()

		await saveRide(userUid, day, hour, route, markers, passengers)

		const isStart = user?.metadata?.schedule?.[day]?.start == hour
		await sendInvitationEmails(passengers, userUid, day, hour, isStart)

		// Return JSON if AJAX request, otherwise redirect
		const wantsJson =
			req.xhr ||
			String(req.headers?.accept || '').includes('application/json') ||
			(typeof req.get === 'function' &&
				String(req.get('Content-Type') || '').includes(
					'application/json'
				))

		if (wantsJson) {
			return res.json({ saved: true, savedAt: nowIso })
		}

		return res.redirect(303, `/ride/${day}/${hour}`)
	} catch (error) {
		console.error('Error saving ride route:', error)
		return res.status(500).json({
			error: 'Er is een fout opgetreden bij het opslaan van de rit. Probeer het later opnieuw.'
		})
	}
}
