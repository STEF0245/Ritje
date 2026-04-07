import db from '../firebase/db.js'
import {
	safeTrim,
	sanitizeText,
	isValidHttpsUrl,
	isValidEmail
} from '../utils/input.util.js'
import { isValidFirebaseUid } from '../utils/firebase.util.js'
import {
	createNotification,
	renderWithErrorNotification
} from '../utils/notification.util.js'

const mapFormDataToEditUser = (formData = {}) => {
	const safeFirstName = safeTrim(formData.firstName, 100)
	const safeLastName = safeTrim(formData.lastName, 100)
	const safeEmail = safeTrim(formData.email, 254)
	const safeCity = safeTrim(formData.city, 100)
	const safeStreet = safeTrim(formData.street, 120)
	const safeHouseNumber = safeTrim(formData.houseNumber, 20)
	const safePostalCode = safeTrim(formData.postalCode, 20)
	const safePhotoURL = safeTrim(formData.photoURL, 2048)

	return {
		email: safeEmail,
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

export const getUserPage = (req, res) => {}

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
		city = '',
		street = '',
		houseNumber = '',
		postalCode = '',
		photoURL = ''
	} = req.body

	const safeFirstName = safeTrim(firstName, 100)
	const safeLastName = safeTrim(lastName, 100)
	const safePhoneNumber = safeTrim(phoneNumber, 20)
	const safeEmail = safeTrim(email, 254)
	const safeCity = safeTrim(city, 100)
	const safeStreet = safeTrim(street, 120)
	const safeHouseNumber = safeTrim(houseNumber, 20)
	const safePostalCode = safeTrim(postalCode, 20)
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

	const updates = {
		email: safeEmail,
		photoURL: safePhotoURL,
		phoneNumber: safePhoneNumber,
		name: {
			first: safeFirstName,
			last: safeLastName,
			full: fullName
		},
		address: {
			city: safeCity,
			street: safeStreet,
			houseNumber: safeHouseNumber,
			postalCode: safePostalCode
		}
	}

	db.ref(`users/${uid}`)
		.update(updates)
		.then(() => {
			res.redirect(`/admin/users/${encodeURIComponent(uid)}`)
		})
		.catch((error) => {
			console.error('Error updating user:', error)
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
