const WEEKDAYS = [
	{ key: '1', label: 'Maandag' },
	{ key: '2', label: 'Dinsdag' },
	{ key: '3', label: 'Woensdag' },
	{ key: '4', label: 'Donderdag' },
	{ key: '5', label: 'Vrijdag' }
]

const HOUR_MAP = {
	1: ['8:25', '9:15'],
	2: ['9:15', '10:20'],
	3: ['10:20', '11:10'],
	4: ['11:10', '12:00'],
	5: ['13:00', '13:50'],
	6: ['13:50', '14:40'],
	7: ['14:55', '15:45'],
	8: ['15:45', '16:35']
}

export const resolveHourLabel = (hour, isStart) => {
	if (!hour) return null
	const key = String(hour)
	const [start, end] = HOUR_MAP[key] || []
	return isStart ? start : end
}

export const getNextOccurrenceFor = (dayKey, hourIndex, isStart) => {
	if (!dayKey || !hourIndex) return null
	const timeStr = resolveHourLabel(hourIndex, isStart)
	if (!timeStr) return null
	const [hh, mm] = timeStr.split(':').map((v) => parseInt(v, 10))
	const now = new Date()
	const today = now.getDay()
	const targetDay = Number(dayKey)
	const daysAhead = (targetDay - today + 7) % 7
	const candidate = new Date(now)
	candidate.setDate(now.getDate() + daysAhead)
	candidate.setHours(hh || 0, mm || 0, 0, 0)
	if (candidate <= now) {
		candidate.setDate(candidate.getDate() + 7)
	}
	return candidate
}

export const buildDaySchedules = (schedule = {}) => {
	const daySchedules = WEEKDAYS.map(({ key, label }) => {
		const daySchedule = schedule[key] || null
		const startLabel = resolveHourLabel(daySchedule?.start, true)
		const endLabel = resolveHourLabel(daySchedule?.end, false)
		const startNextDate = daySchedule?.start
			? getNextOccurrenceFor(key, daySchedule.start, true)
			: null
		const endNextDate = daySchedule?.end
			? getNextOccurrenceFor(key, daySchedule.end, false)
			: null

		return {
			key,
			label,
			start: {
				label: startLabel,
				value: daySchedule?.start || null,
				nextDate: startNextDate,
				nextUp: false
			},
			end: {
				label: endLabel,
				value: daySchedule?.end || null,
				nextDate: endNextDate,
				nextUp: false
			},
			isAvailable: Boolean(startLabel && endLabel)
		}
	})

	const now = new Date()
	let earliest = null
	daySchedules.forEach((daySchedule) => {
		if (daySchedule.start.nextDate && daySchedule.start.nextDate >= now) {
			if (!earliest || daySchedule.start.nextDate < earliest) {
				earliest = daySchedule.start.nextDate
			}
		}
		if (daySchedule.end.nextDate && daySchedule.end.nextDate >= now) {
			if (!earliest || daySchedule.end.nextDate < earliest) {
				earliest = daySchedule.end.nextDate
			}
		}
	})

	if (earliest) {
		daySchedules.forEach((daySchedule) => {
			daySchedule.start.nextUp =
				daySchedule.start.nextDate &&
				daySchedule.start.nextDate.getTime() === earliest.getTime()
			daySchedule.end.nextUp =
				daySchedule.end.nextDate &&
				daySchedule.end.nextDate.getTime() === earliest.getTime()
		})
	}

	return {
		daySchedules,
		hasAnySchedule: daySchedules.some(({ isAvailable }) => isAvailable)
	}
}

export const getNextOccurrence = (schedule = {}) => {
	const now = new Date()
	const today = now.getDay()
	let nextEvent = null
	let minDiff = Infinity

	Object.keys(schedule).forEach((dayKey) => {
		const day = Number(dayKey)
		const daySchedule = schedule[dayKey]
		const slots = [
			{ hour: daySchedule?.start, timeIdx: 0 },
			{ hour: daySchedule?.end, timeIdx: 1 }
		]

		slots.forEach(({ hour, timeIdx }) => {
			if (!hour || !HOUR_MAP[hour]) return

			const [hh, mm] = HOUR_MAP[hour][timeIdx].split(':').map(Number)
			const candidate = new Date(now)
			const daysAhead = (day - today + 7) % 7
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

export const isValidOccurrence = (schedule = {}, day, hour) => {
	if (!schedule || !schedule[day]) return false
	const daySchedule = schedule[day]
	return hour === daySchedule.start || hour === daySchedule.end
}