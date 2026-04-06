import db from '../firebase/db.js'
import { forwardGeocode } from '../location/location.service.js'
import { sanitizeText, validateLength } from '../utils/input.util.js'
import { isValidFirebaseUid } from '../utils/firebase.util.js'
import { renderWithPageError } from '../utils/page-error.util.js'

const GEOCODE_TIMEOUT_MS = Number(
	process.env.PROFILE_GEOCODE_TIMEOUT_MS || 7000
)

const parseAndValidateProfileAddress = (body = {}) => {
	const street = sanitizeText(body.street, 120)
	const houseNumber = sanitizeText(body.houseNumber, 20)
	const postalCode = sanitizeText(body.postalCode, 20)
	const city = sanitizeText(body.city, 100)

	validateLength(street, 'Street', 2, 120)
	validateLength(houseNumber, 'House number', 1, 20)
	validateLength(postalCode, 'Postal code', 2, 20)
	validateLength(city, 'City', 2, 100)

	const streetPattern = /^(?=.{2,120}$)[\p{L}\p{N} .,'\-\/]+$/u
	const houseNumberPattern = /^(?=.{1,20}$)[\p{L}\p{N} .\-\/]+$/u
	const postalCodePattern = /^(?=.{2,20}$)[\p{L}\p{N} \-]+$/u
	const cityPattern = /^(?=.{2,100}$)[\p{L}\p{N} .,'\-]+$/u

	if (!streetPattern.test(street)) {
		throw new Error('Street contains invalid characters')
	}

	if (!houseNumberPattern.test(houseNumber)) {
		throw new Error('House number contains invalid characters')
	}

	if (!postalCodePattern.test(postalCode)) {
		throw new Error('Postal code contains invalid characters')
	}

	if (!cityPattern.test(city)) {
		throw new Error('City contains invalid characters')
	}

	return {
		street,
		houseNumber,
		postalCode,
		city
	}
}

const withTimeout = async (promiseFactory, timeoutMs) => {
	const controller = new AbortController()
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

	try {
		return await promiseFactory(controller.signal)
	} finally {
		clearTimeout(timeoutId)
	}
}

export const getProfilePage = (req, res) => {
	res.render('profile', {
		title: 'Profiel'
	})
}

export const getProfileEditPage = (req, res) => {
	res.render('profile-edit', {
		title: 'Bewerk Profiel'
	})
}

export const profileEditController = async (req, res) => {
	const userId = req.user?.uid

	if (!isValidFirebaseUid(userId)) {
		return renderWithPageError(res, {
			status: 403,
			view: 'profile-edit',
			title: 'Bewerk Profiel',
			message: 'Je sessie is ongeldig. Log opnieuw in.'
		})
	}

	let address
	try {
		address = parseAndValidateProfileAddress(req.body)
	} catch {
		return renderWithPageError(res, {
			status: 400,
			view: 'profile-edit',
			title: 'Bewerk Profiel',
			message: 'Controleer straat, huisnummer, postcode en stad.',
			extra: { formData: req.body }
		})
	}

	const query = `${address.street} ${address.houseNumber}, ${address.postalCode} ${address.city}`

	try {
		const { provider, result } = await withTimeout(
			(signal) => forwardGeocode(query, signal),
			GEOCODE_TIMEOUT_MS
		)

		if (!result?.lat || !result?.lon || !result?.raw) {
			return renderWithPageError(res, {
				status: 422,
				view: 'profile-edit',
				title: 'Bewerk Profiel',
				message:
					'Het adres kon niet geverifieerd worden. Controleer je gegevens en probeer opnieuw.',
				extra: { formData: req.body }
			})
		}

		const raw = result.raw
		const address = {
			street: raw.street || address.street,
			houseNumber: raw.housenumber || address.houseNumber,
			postalCode: raw.postcode || address.postalCode,
			city: raw.city || raw.town || raw.village || address.city
		}

		const updates = {
			address,
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
		return renderWithPageError(res, {
			status: 502,
			view: 'profile-edit',
			title: 'Bewerk Profiel',
			message:
				'Adresverificatie is tijdelijk niet beschikbaar. Probeer later opnieuw.',
			extra: { formData: req.body }
		})
	}
}
