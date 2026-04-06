import { verifyIdToken } from '../firebase/auth.js'
import config from '../config.js'
import db from '../firebase/db.js'
import { forwardGeocode } from '../location/location.service.js'

const FIREBASE_UID_PATTERN = /^[A-Za-z0-9_-]{10,128}$/
const GEOCODE_TIMEOUT_MS = Number(
	process.env.PROFILE_GEOCODE_TIMEOUT_MS || 7000
)

const sanitizeText = (value, maxLength) => {
	return `${value ?? ''}`
		.normalize('NFKC')
		.replace(/[\u0000-\u001F\u007F]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, maxLength)
}

const validateAddressField = (value, label, minLength, maxLength) => {
	if (value.length < minLength || value.length > maxLength) {
		throw new Error(`${label} has an invalid length`)
	}
}

const parseAndValidateProfileAddress = (body = {}) => {
	const street = sanitizeText(body.street, 120)
	const houseNumber = sanitizeText(body.houseNumber, 20)
	const postalCode = sanitizeText(body.postalCode, 20)
	const city = sanitizeText(body.city, 100)

	validateAddressField(street, 'Street', 2, 120)
	validateAddressField(houseNumber, 'House number', 1, 20)
	validateAddressField(postalCode, 'Postal code', 2, 20)
	validateAddressField(city, 'City', 2, 100)

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

export const getLoginPage = (req, res) => {
	res.render('login', {
		title: 'Login'
	})
}

export const loginController = async (req, res) => {
	const { idToken } = req.body
	try {
		if (!idToken) {
			return res.status(400).render('login', {
				title: 'Login',
				pageError: {
					status: 400,
					message: 'Inloggen mislukt. Probeer opnieuw.'
				}
			})
		}
		// Verify the token to ensure it is valid
		await verifyIdToken(idToken, true) // Pass true to check if token is revoked

		res.cookie('token', idToken, {
			httpOnly: true,
			secure: config.isProduction,
			sameSite: 'strict',
			maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
		})
		res.redirect('/profile')
	} catch (err) {
		console.error('Login error:', err.message)
		res.status(401).render('login', {
			title: 'Login',
			pageError: {
				status: 401,
				message:
					'Ongeldige login. Controleer je gegevens en probeer opnieuw.'
			}
		})
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

	if (!userId || !FIREBASE_UID_PATTERN.test(userId)) {
		return res.status(403).render('profile-edit', {
			title: 'Bewerk Profiel',
			pageError: {
				status: 403,
				message: 'Je sessie is ongeldig. Log opnieuw in.'
			}
		})
	}

	let address
	try {
		address = parseAndValidateProfileAddress(req.body)
	} catch {
		return res.status(400).render('profile-edit', {
			title: 'Bewerk Profiel',
			formData: req.body,
			pageError: {
				status: 400,
				message: 'Controleer straat, huisnummer, postcode en stad.'
			}
		})
	}

	const query = `${address.street} ${address.houseNumber}, ${address.postalCode} ${address.city}`

	try {
		const { provider, result } = await withTimeout(
			(signal) => forwardGeocode(query, signal),
			GEOCODE_TIMEOUT_MS
		)

		if (!result?.lat || !result?.lon) {
			return res.status(422).render('profile-edit', {
				title: 'Bewerk Profiel',
				formData: req.body,
				pageError: {
					status: 422,
					message:
						'Het adres kon niet geverifieerd worden. Controleer je gegevens en probeer opnieuw.'
				}
			})
		}

		const updates = {
			address,
			coords: {
				latitude: result.lat,
				longitude: result.lon
			},
			geocoding: {
				provider,
				updatedAt: new Date().toISOString()
			}
		}

		await db.ref(`users/${userId}`).update(updates)

		return res.redirect('/profile')
	} catch (error) {
		console.error('Profile update geocoding error:', error?.message)
		return res.status(502).render('profile-edit', {
			title: 'Bewerk Profiel',
			formData: req.body,
			pageError: {
				status: 502,
				message:
					'Adresverificatie is tijdelijk niet beschikbaar. Probeer later opnieuw.'
			}
		})
	}
}

export const logoutController = (req, res) => {
	res.clearCookie('token', {
		httpOnly: true,
		secure: config.isProduction,
		sameSite: 'strict'
	})
	res.redirect('/login')
}
