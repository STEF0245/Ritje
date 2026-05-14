import { buildRidePayload } from '../ride/ride.controller.js'
import { respondWithNotification } from '../utils/notification.util.js'
import {
	getNextOccurrence,
	isValidOccurrence
} from '../utils/schedule.util.js'

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
			const nextOccurrence = getNextOccurrence(req.user?.metadata?.schedule || {})
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

const mapRidePayloadToDashboard = (payload) => {
	const { currentRide, route, mapMarkers, day, hour } = payload || {}
	return {
		route: currentRide?.route || route || null,
		markers: currentRide?.markers || mapMarkers || [],
		currentRide: currentRide,
		day: day,
		hour: hour,
		daySchedules: payload?.daySchedules || [],
		hasAnySchedule: payload?.hasAnySchedule || false,
		selectedKey: payload?.selectedKey || '',
		selectedValue: payload?.selectedValue || ''
	}
}
