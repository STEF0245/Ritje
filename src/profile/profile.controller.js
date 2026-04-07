/**
 * @file Profile controller for rendering the profile UI and updating address data.
 * @brief  Summary: Handles profile page requests and profile edit submissions.
 * @details  Details: Provides handlers for showing profile screens and processing address updates with validation, geocoding, and persistence.
 */

import db from '../firebase/db.js'
import { forwardGeocode } from '../location/location.service.js'
import {
	normalizeGeocodedAddress,
	parseAndValidateAddress,
	withTimeout
} from '../utils/address.util.js'
import { isValidFirebaseUid } from '../utils/firebase.util.js'
import {
	createNotification,
	renderWithErrorNotification
} from '../utils/notification.util.js'

const GEOCODE_TIMEOUT_MS = Number(
	process.env.PROFILE_GEOCODE_TIMEOUT_MS || 7000
)

const GEOCODE_ERROR_MESSAGE =
	'Adresverificatie is tijdelijk niet beschikbaar. Probeer later opnieuw.'

/**
 * @brief  Summary: Render the profile edit page with normalized form feedback.
 * @details  Details: Centralizes profile edit re-rendering so error branches can supply consistent status codes, form state, and notifications.
 * @param {object} res - Express response object.
 * @param {number} statusCode - HTTP status code to send.
 * @param {object} formData - Current form values.
 * @param {Array<object>} notifications - Notifications to display.
 * @returns {object} Express response.
 */
const renderProfileEditPage = (res, statusCode, formData, notifications) => {
	return res.status(statusCode).render('profile_edit', {
		title: 'Bewerk Profiel',
		formData,
		notifications
	})
}

/**
 * @brief  Summary: Render the profile overview page.
 * @details  Details: Responds with the profile page for the currently authenticated user.
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
 * @brief  Summary: Render the profile edit page.
 * @details  Details: Responds with the profile edit form for the currently authenticated user.
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
 * @brief  Summary: Update the authenticated user's address and coordinates.
 * @details  Details: Validates the address payload, geocodes it, and persists the normalized result.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @returns {Promise<object>} Express response.
 * @throws {Error} Throws when geocoding or persistence fails.
 */
export const profileEditController = async (req, res) => {
	const userId = req.user?.uid

	if (!isValidFirebaseUid(userId)) {
		return renderWithErrorNotification(res, {
			status: 403,
			view: 'profile_edit',
			title: 'Bewerk Profiel',
			message: 'Je sessie is ongeldig. Log opnieuw in.'
		})
	}

	let addressFields
	try {
		addressFields = parseAndValidateAddress(req.body)
	} catch {
		return renderProfileEditPage(res, 400, req.body, [
			createNotification(
				'error',
				'Ongeldige adresgegevens',
				'Controleer straat, huisnummer, postcode en stad.'
			)
		])
	}

	const query = `${addressFields.street} ${addressFields.houseNumber}, ${addressFields.postalCode} ${addressFields.city}`

	try {
		const geocodeResult = await withTimeout(
			(signal) => forwardGeocode(query, signal),
			GEOCODE_TIMEOUT_MS
		)
		const { result } = geocodeResult

		if (!result?.lat || !result?.lon || !result?.raw) {
			return renderProfileEditPage(res, 422, req.body, [
				createNotification(
					'error',
					'Adresverificatie mislukt',
					'Het adres kon niet geverifieerd worden. Controleer je gegevens en probeer opnieuw.'
				)
			])
		}

		const normalizedAddress = normalizeGeocodedAddress(
			result.raw,
			addressFields
		)

		const updates = {
			address: normalizedAddress,
			coords: {
				latitude: result.lat,
				longitude: result.lon
			},
			updatedAt: new Date()
		}

		await db.ref(`users/${userId}`).update(updates)

		return res.redirect('/profile')
	} catch (error) {
		console.error('Profile update geocoding error:', error?.message)
		return renderProfileEditPage(res, 502, req.body, [
			createNotification(
				'error',
				'Adresverificatie mislukt',
				GEOCODE_ERROR_MESSAGE
			)
		])
	}
}
