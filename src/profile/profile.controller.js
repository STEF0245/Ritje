/**
 * @file Profile controller for rendering the profile UI and updating address data.
 * @brief  Handles profile page requests and profile edit submissions.
 * @details  Provides handlers for showing profile screens and processing address updates with validation, geocoding, and persistence.
 */

import db from '../firebase/db.js'
import { forwardGeocode } from '../location/location.service.js'
import {
	hasCompleteAddress,
	normalizeGeocodedAddress,
	parseAndValidateAddress,
	withTimeout
} from '../utils/address.util.js'
import { isValidFirebaseUid } from '../utils/firebase.util.js'
import { respondWithNotification } from '../utils/notification.util.js'

const GEOCODE_TIMEOUT_MS = Number(
	process.env.PROFILE_GEOCODE_TIMEOUT_MS || 7000
)
const PROFILE_EDIT_VIEW = 'profile_edit'
const PROFILE_EDIT_TITLE = 'Bewerk Profiel'

const GEOCODE_ERROR_MESSAGE =
	'Adresverificatie is tijdelijk niet beschikbaar. Probeer later opnieuw.'

const WEEKDAY_KEYS = ['1', '2', '3', '4', '5']

const normalizeHourInput = (value) => {
	if (value === null || value === undefined) return null
	const raw = String(value).trim()
	if (!raw) return null
	const hour = Number(raw)
	if (!Number.isInteger(hour) || hour < 1 || hour > 8) {
		throw new Error('INVALID_HOUR')
	}
	return hour
}

const parseScheduleFromBody = (body = {}) => {
	const hasSchedulePayload = WEEKDAY_KEYS.some(
		(day) =>
			Object.prototype.hasOwnProperty.call(
				body,
				`scheduleStart_${day}`
			) ||
			Object.prototype.hasOwnProperty.call(body, `scheduleEnd_${day}`)
	)

	if (!hasSchedulePayload) return null

	const schedule = {}

	for (const day of WEEKDAY_KEYS) {
		const startHour = normalizeHourInput(body[`scheduleStart_${day}`])
		const endHour = normalizeHourInput(body[`scheduleEnd_${day}`])

		if ((startHour === null) !== (endHour === null)) {
			throw new Error('INCOMPLETE_DAY_RANGE')
		}

		if (startHour !== null && endHour !== null && endHour < startHour) {
			throw new Error('INVALID_DAY_RANGE')
		}

		schedule[day] = {
			start: startHour,
			end: endHour
		}
	}

	return schedule
}

const renderProfileEditError = (res, options = {}) => {
	const {
		status = 400,
		label = null,
		message = null,
		formData = {}
	} = options

	return respondWithNotification(res, {
		type: 'error',
		label,
		message,
		status,
		view: PROFILE_EDIT_VIEW,
		title: PROFILE_EDIT_TITLE,
		extra: { formData }
	})
}

const normalizeAddressForCompare = (address = {}) => {
	const normalize = (value) =>
		String(value || '')
			.trim()
			.toLowerCase()
	return {
		street: normalize(address.street),
		houseNumber: normalize(address.houseNumber),
		postalCode: normalize(address.postalCode),
		city: normalize(address.city)
	}
}

const areAddressesEquivalent = (left, right) => {
	const a = normalizeAddressForCompare(left)
	const b = normalizeAddressForCompare(right)
	return (
		a.street === b.street &&
		a.houseNumber === b.houseNumber &&
		a.postalCode === b.postalCode &&
		a.city === b.city
	)
}

const getPositiveInteger = (value) => {
	if (value === null || value === undefined) return null
	const raw = String(value).trim()
	if (!raw) return null
	const number = Number(raw)
	if (!Number.isInteger(number) || number < 0) {
		throw new Error('INVALID_POSITIVE_INTEGER')
	}
	return number
}

/**
 * @brief  Render the profile overview page.
 * @details  Responds with the profile page for the currently authenticated user.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @returns {object} Express response.
 */
export const getProfilePage = (req, res) => {
	res.render('profile', {
		title: 'Profiel'
	})
}

/**
 * @brief  Render the profile edit page.
 * @details  Responds with the profile edit form for the currently authenticated user.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @returns {object} Express response.
 */
export const getProfileEditPage = (req, res) => {
	res.render('profile_edit', {
		title: 'Bewerk Profiel'
	})
}

/**
 * @brief  Update the authenticated user's address and coordinates.
 * @details  Validates the address payload, geocodes it, and persists the normalized result.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @returns {Promise<object>} Express response.
 * @throws {Error} Throws when geocoding or persistence fails.
 */
export const profileEditController = async (req, res) => {
	const userId = req.user?.uid

	if (!isValidFirebaseUid(userId)) {
		return renderProfileEditError(res, {
			status: 403,
			message: 'Je sessie is ongeldig. Log opnieuw in.',
			formData: req.body
		})
	}

	let schedule
	try {
		schedule = parseScheduleFromBody(req.body)
	} catch {
		return renderProfileEditError(res, {
			status: 400,
			label: 'Ongeldig uurrooster',
			message:
				'Kies per dag een geldige begin- en eindles. De eindles moet gelijk of later zijn dan de beginles.',
			formData: req.body
		})
	}

	let addressFields
	try {
		addressFields = parseAndValidateAddress(req.body)
	} catch {
		return renderProfileEditError(res, {
			status: 400,
			label: 'Ongeldige adresgegevens',
			message: 'Controleer straat, huisnummer, postcode en stad.',
			formData: req.body
		})
	}

	let ridePreferences
	try {
		ridePreferences = {
			seats: {
				total: getPositiveInteger(req.body.seatsTotal)
			},
			detour: {
				distance: getPositiveInteger(req.body.maxDetourDistance),
				duration: getPositiveInteger(req.body.maxDetourDuration)
			}
		}
	} catch (error) {
		return renderProfileEditError(res, {
			status: 400,
			label: 'Ongeldige ritvoorkeuren',
			message:
				'Controleer of de waarden voor zitplaatsen, wachttijd en maximale afwijking geldig zijn.',
			formData: req.body
		})
	}

	try {
		const userSnapshot = await db.ref(`users/${userId}`).once('value')
		const existingUser = userSnapshot.val() || {}
		const existingAddress = existingUser?.address || {}
		const shouldGeocode = !areAddressesEquivalent(
			addressFields,
			existingAddress
		)

		if (!shouldGeocode && !schedule) {
			return res.redirect('/profile')
		}

		const updates = {}

		if (ridePreferences) {
			updates.preferences = ridePreferences
		}

		if (schedule) {
			updates.schedule = schedule
		}

		if (!shouldGeocode) {
			await db.ref(`users/${userId}`).update(updates)
			return res.redirect('/profile')
		}

		const query = `${addressFields.street} ${addressFields.houseNumber}, ${addressFields.postalCode} ${addressFields.city}`

		const geocodeResult = await withTimeout(
			(signal) => forwardGeocode(query, signal),
			GEOCODE_TIMEOUT_MS
		)
		const { result } = geocodeResult

		if (!result?.lat || !result?.lon || !result?.raw) {
			return renderProfileEditError(res, {
				status: 422,
				label: 'Adresverificatie mislukt',
				message:
					'Het adres kon niet geverifieerd worden. Controleer je gegevens en probeer opnieuw.',
				formData: req.body
			})
		}

		const normalizedAddress = normalizeGeocodedAddress(
			result.raw,
			addressFields
		)
		if (!hasCompleteAddress(normalizedAddress)) {
			return renderProfileEditError(res, {
				status: 422,
				label: 'Adresverificatie mislukt',
				message:
					'Het adres kon niet geverifieerd worden. Controleer je gegevens en probeer opnieuw.',
				formData: req.body
			})
		}

		updates.address = normalizedAddress
		updates.coords = {
			latitude: result.lat,
			longitude: result.lon
		}

		await db.ref(`users/${userId}`).update(updates)

		return res.redirect('/profile')
	} catch (error) {
		console.error('Profile update error:', error?.message)
		return renderProfileEditError(res, {
			status: 502,
			label: 'Adresverificatie mislukt',
			message: GEOCODE_ERROR_MESSAGE,
			formData: req.body
		})
	}
}
