import db from '../firebase/db.js'
import { forwardGeocode } from '../location/location.service.js'
import {
	safeTrim,
	sanitizeText,
	validateLength,
	isValidHttpsUrl,
	isValidEmail
} from '../utils/input.util.js'
import { isValidFirebaseUid } from '../utils/firebase.util.js'
import {
	createNotification,
	renderWithErrorNotification
} from '../utils/notification.util.js'

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

const mapFormDataToEditUser = (formData = {}) => {
	const safeFirstName = safeTrim(formData.firstName, 100)
	const safeLastName = safeTrim(formData.lastName, 100)
	const safeEmail = safeTrim(formData.email, 254)
	const safePhoneNumber = safeTrim(formData.phoneNumber, 20)
	const safeCity = safeTrim(formData.city, 100)
	const safeStreet = safeTrim(formData.street, 120)
	const safeHouseNumber = safeTrim(formData.houseNumber, 20)
	const safePostalCode = safeTrim(formData.postalCode, 20)
	const safePhotoURL = safeTrim(formData.photoURL, 2048)

	return {
		email: safeEmail,
		phoneNumber: safePhoneNumber,
		photoURL: safePhotoURL,
		name: {
			first: safeFirstName,
			last: safeLastName,
			full: `${safeFirstName} ${safeLastName}`.trim()
		},
		address: {
			city: safeCity,
			street: safeStreet,
			houseNumber: safeHouseNumber,
			postalCode: safePostalCode
		}
	}
}

export const getAdminPage = (req, res) => {
	res.render('admin', {
		title: 'Dashboard | Admin'
	})
}

export const getUsersPage = (req, res) => {
	db.ref('users')
		.once('value')
		.then((snapshot) => {
			const usersData = snapshot.val() || {}
			res.render('admin_users', {
				title: 'Gebruikers | Admin',
				users: usersData
			})
		})
		.catch((error) => {
			console.error('Error fetching users:', error)
			return renderWithErrorNotification(res, {
				status: 500,
				view: 'admin_users',
				title: 'Gebruikers | Admin',
				message:
					'Gebruikers konden niet worden geladen. Probeer het opnieuw.',
				extra: { users: {} }
			})
		})
}

export const getUsersNewPage = (req, res) => {
	res.render('admin_users_new', {
		title: 'Nieuw | Gebruikers | Admin'
	})
}

export const postUserNewPage = (req, res) => {}

export const getUserPage = (req, res) => {
	const { uid } = req.params
	if (!isValidFirebaseUid(uid)) {
		return renderWithErrorNotification(res, {
			status: 400,
			view: 'admin_user',
			title: 'Gebruiker | Admin',
			message: 'Ongeldige gebruikers-ID opgegeven.',
			extra: {
				userUid: uid,
				viewUser: {}
			}
		})
	}

	db.ref(`users/${uid}`)
		.once('value')
		.then((snapshot) => {
			const userData = snapshot.val()

			if (!userData) {
				return renderWithErrorNotification(res, {
					status: 404,
					view: 'admin_user',
					title: 'Gebruiker | Admin',
					message: 'Deze gebruiker bestaat niet of is verwijderd.',
					extra: {
						userUid: uid,
						viewUser: {}
					}
				})
			}

			return res.render('admin_user', {
				title: 'Gebruiker | Admin',
				userUid: uid,
				viewUser: userData
			})
		})
		.catch((error) => {
			console.error('Error fetching user detail page:', error)
			return renderWithErrorNotification(res, {
				status: 500,
				view: 'admin_user',
				title: 'Gebruiker | Admin',
				message:
					'Gebruiker kon niet worden geladen. Probeer het opnieuw.',
				extra: {
					userUid: uid,
					viewUser: {}
				}
			})
		})
}

export const getUserEditPage = (req, res) => {
	const { uid } = req.params
	if (!isValidFirebaseUid(uid)) {
		return renderWithErrorNotification(res, {
			status: 400,
			view: 'admin_user_edit',
			title: 'Bewerk | Gebruikers | Admin',
			message: 'Ongeldige gebruikers-ID opgegeven.',
			extra: {
				userUid: uid,
				editUser: {}
			}
		})
	}

	db.ref(`users/${uid}`)
		.once('value')
		.then((snapshot) => {
			const userData = snapshot.val()

			if (!userData) {
				return renderWithErrorNotification(res, {
					status: 404,
					view: 'admin_user_edit',
					title: 'Bewerk | Gebruikers | Admin',
					message: 'Deze gebruiker bestaat niet of is verwijderd.',
					extra: {
						userUid: uid,
						editUser: {}
					}
				})
			}

			return res.render('admin_user_edit', {
				title: 'Bewerk | Gebruikers | Admin',
				userUid: uid,
				editUser: userData
			})
		})
		.catch((error) => {
			console.error('Error fetching user for edit page:', error)
			return renderWithErrorNotification(res, {
				status: 500,
				view: 'admin_user_edit',
				title: 'Bewerk | Gebruikers | Admin',
				message:
					'Gebruiker kon niet worden geladen. Probeer het opnieuw.',
				extra: {
					userUid: uid,
					editUser: {}
				}
			})
		})
}

export const postUserEditPage = (req, res) => {
	const { uid } = req.params
	if (!isValidFirebaseUid(uid)) {
		return renderWithErrorNotification(res, {
			status: 400,
			view: 'admin_user_edit',
			title: 'Bewerk | Gebruikers | Admin',
			message: 'Ongeldige gebruikers-ID opgegeven.',
			extra: {
				userUid: uid,
				editUser: mapFormDataToEditUser(req.body)
			}
		})
	}

	const {
		firstName = '',
		lastName = '',
		email = '',
		phoneNumber = '',
		photoURL = ''
	} = req.body

	const safeFirstName = safeTrim(firstName, 100)
	const safeLastName = safeTrim(lastName, 100)
	const safePhoneNumber = safeTrim(phoneNumber, 20)
	const safeEmail = safeTrim(email, 254)
	const safePhotoURL = safeTrim(photoURL, 2048)
	const fullName = `${safeFirstName} ${safeLastName}`.trim()

	if (safeEmail && !isValidEmail(safeEmail)) {
		return renderWithErrorNotification(res, {
			status: 400,
			view: 'admin_user_edit',
			title: 'Bewerk | Gebruikers | Admin',
			message: 'Ongeldig e-mailadres opgegeven.',
			extra: {
				userUid: uid,
				editUser: mapFormDataToEditUser(req.body)
			}
		})
	}

	if (!isValidHttpsUrl(safePhotoURL)) {
		return renderWithErrorNotification(res, {
			status: 400,
			view: 'admin_user_edit',
			title: 'Bewerk | Gebruikers | Admin',
			message: 'Profielfoto-URL moet een geldige HTTPS URL zijn.',
			extra: {
				userUid: uid,
				editUser: mapFormDataToEditUser(req.body)
			}
		})
	}

	let address
	try {
		address = parseAndValidateProfileAddress(req.body)
	} catch {
		return res.status(400).render('admin_user_edit', {
			title: 'Bewerk | Gebruikers | Admin',
			userUid: uid,
			editUser: mapFormDataToEditUser(req.body),
			notifications: [
				createNotification(
					'error',
					'Ongeldige adresgegevens',
					'Controleer straat, huisnummer, postcode en stad.'
				)
			]
		})
	}

	const query = `${address.street} ${address.houseNumber}, ${address.postalCode} ${address.city}`

	return withTimeout(
		(signal) => forwardGeocode(query, signal),
		GEOCODE_TIMEOUT_MS
	)
		.then(({ result }) => {
			if (!result?.lat || !result?.lon || !result?.raw) {
				return res.status(422).render('admin_user_edit', {
					title: 'Bewerk | Gebruikers | Admin',
					userUid: uid,
					editUser: mapFormDataToEditUser(req.body),
					notifications: [
						createNotification(
							'error',
							'Adresverificatie mislukt',
							'Het adres kon niet geverifieerd worden. Controleer je gegevens en probeer opnieuw.'
						)
					]
				})
			}

			const raw = result.raw
			const normalizedAddress = {
				street: raw.street || address.street,
				houseNumber: raw.housenumber || address.houseNumber,
				postalCode: raw.postcode || address.postalCode,
				city: raw.village || raw.city || raw.town || address.city
			}

			const updates = {
				email: safeEmail,
				photoURL: safePhotoURL,
				phoneNumber: safePhoneNumber,
				name: {
					first: safeFirstName,
					last: safeLastName,
					full: fullName
				},
				address: normalizedAddress,
				coords: {
					latitude: result.lat,
					longitude: result.lon
				},
				updatedAt: new Date()
			}

			return db
				.ref(`users/${uid}`)
				.update(updates)
				.then(() => {
					res.redirect(`/admin/users/${encodeURIComponent(uid)}`)
				})
				.catch((error) => {
					console.error('Error updating admin user:', error)
					return renderWithErrorNotification(res, {
						status: 500,
						view: 'admin_user_edit',
						title: 'Bewerk | Gebruikers | Admin',
						message:
							'Gebruiker kon niet worden opgeslagen. Probeer het opnieuw.',
						extra: {
							userUid: uid,
							editUser: mapFormDataToEditUser(req.body)
						}
					})
				})
		})
		.catch((error) => {
			console.error('Admin user update geocoding error:', error?.message)
			return res.status(502).render('admin_user_edit', {
				title: 'Bewerk | Gebruikers | Admin',
				userUid: uid,
				editUser: mapFormDataToEditUser(req.body),
				notifications: [
					createNotification(
						'error',
						'Adresverificatie mislukt',
						'Adresverificatie is tijdelijk niet beschikbaar. Probeer later opnieuw.'
					)
				]
			})
		})
}

const SETTINGS = {
	maintenance: {
		title: 'Onderhoudsmodus',
		description:
			'Schakel deze modus in om het platform tijdelijk onbereikbaar te maken voor gebruikers. Handig voor updates of onderhoud.',
		enabled: false,
		message:
			'Het platform is tijdelijk in onderhoud. Probeer het later opnieuw.',
		startTime: null,
		endTime: null,
		allowAdminAccess: true,

		inputTypes: {
			enabled: 'boolean',
			message: 'string',
			startTime: 'datetime',
			endTime: 'datetime',
			allowAdminAccess: 'boolean'
		}
	}
}

const SETTINGS_META_KEYS = new Set(['title', 'description', 'inputTypes'])

const getLastFormValue = (value) => {
	if (Array.isArray(value)) {
		return value[value.length - 1]
	}

	return value
}

const parseSettingValueByType = (type, rawValue) => {
	if (type === 'boolean') {
		return String(getLastFormValue(rawValue)) === 'true'
	}

	if (type === 'datetime') {
		const raw = safeTrim(getLastFormValue(rawValue), 40)
		if (!raw) return null

		const parsed = new Date(raw)
		if (Number.isNaN(parsed.getTime())) return null

		return parsed.toISOString()
	}

	return sanitizeText(getLastFormValue(rawValue), 1024)
}

const buildSettingsViewModel = (settingsData = {}) => {
	const mergedSettings = {}

	for (const [sectionKey, sectionDefaults] of Object.entries(SETTINGS)) {
		const sourceSection = settingsData?.[sectionKey] || {}
		const mergedSection = {
			...sectionDefaults,
			...sourceSection,
			inputTypes: {
				...(sectionDefaults.inputTypes || {}),
				...(sourceSection.inputTypes || {})
			}
		}

		mergedSettings[sectionKey] = mergedSection
	}

	return mergedSettings
}

const mapFormDataToSettings = (formData = {}, existingSettings = {}) => {
	const normalizedExistingSettings = existingSettings || {}
	const nextSettings = {}

	for (const [sectionKey, sectionDefaults] of Object.entries(SETTINGS)) {
		const sectionInputTypes = sectionDefaults.inputTypes || {}
		const existingSection = normalizedExistingSettings[sectionKey] || {}
		const parsedSection = {
			...existingSection
		}

		for (const [propKey, defaultValue] of Object.entries(sectionDefaults)) {
			if (SETTINGS_META_KEYS.has(propKey)) continue

			const formFieldName = `${sectionKey}__${propKey}`
			const inputType = sectionInputTypes[propKey] || 'string'
			const hasValue = Object.prototype.hasOwnProperty.call(
				formData,
				formFieldName
			)

			if (hasValue) {
				parsedSection[propKey] = parseSettingValueByType(
					inputType,
					formData[formFieldName]
				)
				continue
			}

			if (inputType === 'boolean') {
				parsedSection[propKey] = false
				continue
			}

			parsedSection[propKey] = existingSection[propKey] ?? defaultValue
		}

		nextSettings[sectionKey] = parsedSection
	}

	return nextSettings
}

export const getSettingsPage = (req, res) => {
	db.ref('settings')
		.once('value')
		.then((snapshot) => {
			const settingsData = snapshot.val() || {}
			res.render('admin_settings', {
				title: 'Instellingen | Admin',
				settings: buildSettingsViewModel(settingsData)
			})
		})
		.catch((error) => {
			console.error('Error fetching settings:', error)
			return res.status(500).render('admin_settings', {
				title: 'Instellingen | Admin',
				settings: buildSettingsViewModel(),
				notifications: [
					createNotification(
						'error',
						'Fout',
						'Instellingen konden niet worden geladen. Probeer het opnieuw.'
					)
				]
			})
		})
}

export const postSettingsPage = (req, res) => {
	let nextSettings = null

	db.ref('settings')
		.once('value')
		.then((snapshot) => {
			const currentSettings = snapshot.val() || {}
			nextSettings = mapFormDataToSettings(req.body, currentSettings)

			return db.ref('settings').update(nextSettings)
		})
		.then(() => {
			return res.render('admin_settings', {
				title: 'Instellingen | Admin',
				settings: buildSettingsViewModel(nextSettings || {}),
				notifications: [
					createNotification(
						'success',
						'Succes',
						'Instellingen succesvol opgeslagen.'
					)
				]
			})
		})
		.catch((error) => {
			console.error('Error saving settings:', error)
			return res.status(500).render('admin_settings', {
				title: 'Instellingen | Admin',
				settings: buildSettingsViewModel(
					mapFormDataToSettings(req.body, {})
				),
				notifications: [
					createNotification(
						'error',
						'Fout',
						'Instellingen konden niet worden opgeslagen. Probeer het opnieuw.'
					)
				]
			})
		})
}
