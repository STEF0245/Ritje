import { buildRidePayload } from '../ride/ride.controller.js'
import { respondWithNotification } from '../utils/notification.util.js'

export const getDashboardPage = async (req, res) => {
	try {
		const day =
			req.params.day !== undefined ? parseInt(req.params.day) : null
		const hour =
			req.params.hour !== undefined ? parseInt(req.params.hour) : null

		// If no day/hour provided, find the next one and redirect
		if ((day === null || isNaN(day)) && (hour === null || isNaN(hour))) {
			const nextOccurrence = getNextOccurrence(req)
			if (nextOccurrence) {
				return res.redirect(
					`/dashboard/${nextOccurrence.day}/${nextOccurrence.hour}`
				)
			}
			return respondWithNotification(res, {
				type: 'info',
				label: 'Geen ritten gepland',
				message: 'Er zijn momenteel geen geplande ritten in je schema.',
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
		hour: hour
	}
}

const getNextOccurrence = (req) => {
	const schedule = req.user?.metadata?.schedule || {}
	const now = new Date()
	const today = now.getDay()

	const hourMap = {
		1: ['08:25', '09:15'],
		2: ['09:15', '10:20'],
		3: ['10:20', '11:10'],
		4: ['11:10', '12:00'],
		5: ['13:00', '13:50'],
		6: ['13:50', '14:40'],
		7: ['14:55', '15:45'],
		8: ['15:45', '16:35']
	}

	let nextEvent = null
	let minDiff = Infinity

	Object.keys(schedule).forEach((dayKey) => {
		const day = Number(dayKey)
		const daySchedule = schedule[dayKey]

		// Check both start and end slots
		// Using index 0 for 'start' time and index 1 for 'end' time
		const slots = [
			{ hour: daySchedule.start, timeIdx: 0 },
			{ hour: daySchedule.end, timeIdx: 1 }
		]

		slots.forEach(({ hour, timeIdx }) => {
			if (!hour || !hourMap[hour]) return

			const [hh, mm] = hourMap[hour][timeIdx].split(':').map(Number)
			const candidate = new Date(now)

			let daysAhead = (day - today + 7) % 7
			candidate.setDate(now.getDate() + daysAhead)
			candidate.setHours(hh, mm, 0, 0)

			if (candidate <= now) candidate.setDate(candidate.getDate() + 7)

			const diff = candidate.getTime() - now.getTime()
			if (diff < minDiff) {
				minDiff = diff
				nextEvent = { day, hour }
			}
		})
	})

	return nextEvent
}
