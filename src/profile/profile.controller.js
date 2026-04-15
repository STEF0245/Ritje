/**
 * @file Profile controller for rendering the profile UI and updating address data.
 * @brief  Handles profile page requests and profile edit submissions.
 * @details  Provides handlers for showing profile screens and processing address updates with validation, geocoding, and persistence.
 */

import db from '../firebase/db.js'
import { forwardGeocode } from '../location/location.service.js'
import {
	normalizeGeocodedAddress,
	parseAndValidateAddress,
	withTimeout
} from '../utils/address.util.js'
import { isValidFirebaseUid } from '../utils/firebase.util.js'
import { respondWithNotification } from '../utils/notification.util.js'

const GEOCODE_TIMEOUT_MS = Number(
	process.env.PROFILE_GEOCODE_TIMEOUT_MS || 7000
)

const GEOCODE_ERROR_MESSAGE =
	'Adresverificatie is tijdelijk niet beschikbaar. Probeer later opnieuw.'

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
		return respondWithNotification(res, {
			type: 'error',
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
		return respondWithNotification(res, {
			type: 'error',
			label: 'Ongeldige adresgegevens',
			message: 'Controleer straat, huisnummer, postcode en stad.',
			status: 400,
			view: 'profile_edit',
			title: 'Bewerk Profiel',
			extra: { formData: req.body }
		})
	}

	const query = `${addressFields.street} ${addressFields.houseNumber}, ${addressFields.postalCode} ${addressFields.city}`

	try {
		const geocodeResult = await withTimeout(
			(signal) => forwardGeocode(query, signal),
			GEOCODE_TIMEOUT_MS
		)
		const { result } = geocodeResult

		if (!result?.lat || !result?.lon || !result?.raw) {
			return respondWithNotification(res, {
				type: 'error',
				label: 'Adresverificatie mislukt',
				message:
					'Het adres kon niet geverifieerd worden. Controleer je gegevens en probeer opnieuw.',
				status: 422,
				view: 'profile_edit',
				title: 'Bewerk Profiel',
				extra: { formData: req.body }
			})
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
		return respondWithNotification(res, {
			type: 'error',
			label: 'Adresverificatie mislukt',
			message: GEOCODE_ERROR_MESSAGE,
			status: 502,
			view: 'profile_edit',
			title: 'Bewerk Profiel',
			extra: { formData: req.body }
		})
	}
}
