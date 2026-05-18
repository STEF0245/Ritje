/**
 * @file School schedule management and time slot calculations.
 * @brief Provides weekday/hour mapping and "next occurrence" date calculations.
 * @details Manages the 8 hourly slots (1-8) for the school week (Mon-Fri). Calculates the next scheduled occurrence of a given slot, marks the earliest upcoming slot as "nextUp", and builds normalized schedule objects for template rendering.
 */

const WEEKDAYS = [
	{ day: '1', label: 'Maandag' },
	{ day: '2', label: 'Dinsdag' },
	{ day: '3', label: 'Woensdag' },
	{ day: '4', label: 'Donderdag' },
	{ day: '5', label: 'Vrijdag' }
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

/**
 * @brief Resolves a time label (start or end) for a schedule hour.
 * @param {number} hour - Schedule slot (1-8).
 * @param {boolean} isStart - True for start time, false for end time.
 * @returns {string|null} - Time label like "8:25" or null if invalid hour.
 */
export const resolveHourLabel = (hour, isStart) => {
	if (!hour) return null
	const key = String(hour)
	const [start, end] = HOUR_MAP[key] || []
	return isStart ? start : end
}

/**
 * @brief Calculates the next occurrence of a specific day/hour/time combination.
 * @param {string|number} dayKey - Weekday key (1-5).
 * @param {number} hourIndex - Schedule slot (1-8).
 * @param {boolean} isStart - True for start time, false for end time.
 * @returns {Date|null} - Next Date when this slot occurs, or null if invalid.
 */
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

/**
 * @brief Builds normalized day schedule objects with start/end times and "nextUp" flags.
 * @param {object} schedule - Schedule object with days mapped to {start, end} hour slots.
 * @returns {{daySchedules: Array<object>, hasAnySchedule: boolean}} - Enriched schedules and presence flag.
 */
export const buildDaySchedules = (schedule = {}) => {
	const daySchedules = WEEKDAYS.map(({ day, label }) => {
		const daySchedule = schedule[day] || null
		const startLabel = resolveHourLabel(daySchedule?.start, true)
		const endLabel = resolveHourLabel(daySchedule?.end, false)
		const startNextDate = daySchedule?.start
			? getNextOccurrenceFor(day, daySchedule.start, true)
			: null
		const endNextDate = daySchedule?.end
			? getNextOccurrenceFor(day, daySchedule.end, false)
			: null

		return {
			day,
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

/**
 * @brief Finds the very next scheduled event across all days/hours.
 * @param {object} schedule - Schedule object with days mapped to {start, end} hour slots.
 * @returns {{day: number, hour: number}|null} - Next event slot or null if no schedule.
 */
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

/**
 * @brief Validates that a day/hour slot is scheduled for the user.
 * @param {object} schedule - Schedule object with days mapped to {start, end} hour slots.
 * @param {number} day - Weekday to check.
 * @param {number} hour - Hour slot to check.
 * @returns {boolean} - True if the slot is in the user's schedule.
 */
export const isValidOccurrence = (schedule = {}, day, hour) => {
	if (!schedule || !schedule[day]) return false
	const daySchedule = schedule[day]
	return hour === daySchedule.start || hour === daySchedule.end
}
