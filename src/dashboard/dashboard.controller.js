import {
	buildRidePayload,
	cancelRideForUser,
	respondToInvitationRide
} from '../ride/ride.controller.js'
import { respondWithNotification } from '../utils/notification.util.js'
import { getNextOccurrence, isValidOccurrence } from '../utils/schedule.util.js'

export const getDashboardPage = async (req, res) => {
	try {
		const day =
			req.params.day !== undefined ? parseInt(req.params.day) : null
		const hour =
			req.params.hour !== undefined ? parseInt(req.params.hour) : null

		// If no day/hour provided, find the next one and redirect
		if (
			((day === null || isNaN(day)) && (hour === null || isNaN(hour))) ||
			!isValidOccurrence(req.user?.metadata?.schedule, day, hour)
		) {
			const nextOccurrence = getNextOccurrence(
				req.user?.metadata?.schedule || {}
			)
			if (nextOccurrence) {
				return res.redirect(
					`/dashboard/${nextOccurrence.day}/${nextOccurrence.hour}`
				)
			}
			return respondWithNotification(res, {
				type: 'info',
				label: 'Geen rooster gevonden',
				message: 'Je hebt geen rooster ingesteld.',
				view: 'dashboard',
				title: 'Dashboard',
				extra: {
					route: null,
					markers: [],
					currentRide: null,
					day: null,
					hour: null
				}
			})
		}

		const payload = await buildRidePayload(req, day, hour)
		const mapped = mapRidePayloadToDashboard(payload)

		return res.render('dashboard', {
			title: 'Dashboard',
			...mapped
		})
	} catch (error) {
		console.error('Error rendering dashboard page:', error)
		return respondWithNotification(res, {
			type: 'error',
			label: 'Fout bij laden dashboard',
			message:
				'Er is een fout opgetreden bij het laden van het dashboard. Probeer het later opnieuw.',
			view: 'dashboard',
			title: 'Dashboard',
			extra: {
				route: null,
				markers: [],
				currentRide: null,
				day: null,
				hour: null
			}
		})
	}
}

export const cancelDashboardRide = async (req, res) => {
	try {
		const day = Number(req.params.day)
		const hour = Number(req.params.hour)
		const ride = await cancelRideForUser({
			userUid: req.user?.uid,
			day,
			hour
		})

		if (!ride) {
			return respondWithNotification(res, {
				type: 'info',
				label: 'Rit niet gevonden',
				message: 'Er was geen actieve rit om te annuleren.',
				redirectTo: `/dashboard/${day}/${hour}`
			})
		}

		return respondWithNotification(res, {
			type: 'success',
			label: 'Rit geannuleerd',
			message: 'De rit is geannuleerd en kan opnieuw worden aangemaakt.',
			redirectTo: `/dashboard/${day}/${hour}`
		})
	} catch (error) {
		console.error('Error canceling dashboard ride:', error)
		return respondWithNotification(res, {
			type: 'error',
			label: 'Annuleren mislukt',
			message:
				'De rit kon niet worden geannuleerd. Probeer het later opnieuw.',
			redirectTo: '/dashboard'
		})
	}
}

export const respondToDashboardRide = async (req, res) => {
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
				redirectTo: `/dashboard/${day}/${hour}`
			})
		}

		const ride = await respondToInvitationRide({
			driverUid,
			day,
			hour,
			passengerUid: req.user?.uid,
			response
		})

		if (!ride) {
			return respondWithNotification(res, {
				type: 'info',
				label: 'Geen uitnodiging',
				message:
					'Deze rit is niet meer beschikbaar of je bent geen genodigde.',
				redirectTo: `/dashboard/${day}/${hour}`
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
			redirectTo: `/dashboard/${day}/${hour}`
		})
	} catch (error) {
		console.error('Error responding to dashboard ride:', error)
		return respondWithNotification(res, {
			type: 'error',
			label: 'Reactie mislukt',
			message:
				'Je reactie kon niet worden opgeslagen. Probeer het later opnieuw.',
			redirectTo: '/dashboard'
		})
	}
}

const mapRidePayloadToDashboard = (payload) => {
	const {
		currentRide,
		route,
		mapMarkers,
		day,
		hour,
		invitationRides = []
	} = payload || {}
	const activeRide = currentRide || null
	const primaryRide = activeRide || invitationRides[0] || null
	return {
		route: primaryRide?.route || route || null,
		markers: primaryRide?.markers || mapMarkers || [],
		currentRide: activeRide,
		invitationRides,
		day: day,
		hour: hour,
		daySchedules: payload?.daySchedules || [],
		hasAnySchedule: payload?.hasAnySchedule || false,
		selectedKey: payload?.selectedKey || '',
		selectedValue: payload?.selectedValue || ''
	}
}
