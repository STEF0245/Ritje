/**
 * @file Admin controller for dashboard, user management, and settings workflows.
 * @brief  Summary: Handles admin rendering, CRUD actions, and settings persistence.
 * @details  Details: This module defines the controller functions for the admin area, including rendering the dashboard, listing users, creating new users, editing existing users, deleting users, and managing application settings. It interacts with Firebase Realtime Database for user data storage and Firebase Authentication for user management. The controller also integrates with a geocoding service to validate and normalize user addresses during creation and editing. Error handling is implemented to provide user-friendly feedback in case of issues during these operations.
 */

import db from '../firebase/db.js'
import { auth, generateRandomUid } from '../firebase/auth.js'
import { forwardGeocode } from '../location/location.service.js'
import {
	normalizeGeocodedAddress,
	parseAndValidateAddress,
	withTimeout
} from '../utils/address.util.js'
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
import { buildRepositoryDocumentation } from '../utils/repository-docs.util.js'

const GEOCODE_TIMEOUT_MS = Number(
	process.env.PROFILE_GEOCODE_TIMEOUT_MS || 7000
)

/**
 * @brief  Summary: Map incoming edit form data to a normalized user payload.
 * @details  Details: Trims all user fields to safe lengths and builds the nested name and address structure used by the admin edit view and update flow.
 * @param {object} formData - Raw form body submitted by the client.
 * @returns {{email: string, phoneNumber: string, photoURL: string, name: {first: string, last: string, full: string}, address: {city: string, street: string, houseNumber: string, postalCode: string}}} Normalized user form data.
 */
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

/**
 * @brief  Summary: Map incoming create form data to a normalized new-user payload.
 * @details  Details: Reuses the edit mapping and appends a sanitized password field required by the create user flow.
 * @param {object} formData - Raw form body submitted by the client.
 * @returns {{email: string, phoneNumber: string, photoURL: string, name: {first: string, last: string, full: string}, address: {city: string, street: string, houseNumber: string, postalCode: string}, password: string}} Normalized new-user form data.
 */
const mapFormDataToNewUser = (formData = {}) => {
	return {
		...mapFormDataToEditUser(formData),
		password: safeTrim(formData.password, 128)
	}
}

/**
 * @brief  Summary: Render the new user page with consistent defaults.
 * @details  Details: Uses shared defaults for response status, draft user data, and notifications to keep all create-user error paths consistent.
 * @param {object} res - Express response object.
 * @param {{status?: number, newUser?: object, notifications?: Array<object>}} options - Page options.
 * @returns {object} Express response.
 */
const renderUserNewPage = (res, options = {}) => {
	return res.status(options.status || 200).render('admin_user_new', {
		title: 'Nieuwe gebruiker | Admin',
		newUser: options.newUser || {},
		notifications: options.notifications || []
	})
}

/**
 * @brief  Summary: Render a user detail page with a consistent error fallback.
 * @details  Details: Wraps `renderWithErrorNotification` so all admin user detail and edit pages receive the same fallback payload structure.
 * @param {object} res - Express response object.
 * @param {string} view - View name to render.
 * @param {string} title - Page title.
 * @param {number} status - HTTP status code.
 * @param {string} message - Error message for the notification.
 * @param {object} extra - Additional view locals.
 * @returns {object} Express response.
 */
const renderUserDetailError = (res, view, title, status, message, extra) => {
	return renderWithErrorNotification(res, {
		status,
		view,
		title,
		message,
		extra
	})
}

/**
 * @brief  Summary: Render the admin dashboard landing page.
 * @details  Details: Responds with the main admin dashboard view container.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @returns {object} Express response.
 */
export const getAdminPage = (req, res) => {
	res.render('admin', {
		title: 'Dashboard | Admin'
	})
}

/**
 * @brief  Summary: Render the admin user list.
 * @details  Details: Reads all users from Realtime Database and renders them in the admin listing view. If retrieval fails, renders the view with an error notification and an empty collection.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @returns {Promise<object>} Express response.
 */
export const getUsersPage = async (req, res) => {
	try {
		const snapshot = await db.ref('users').once('value')
		const usersData = snapshot.val() || {}

		return res.render('admin_users', {
			title: 'Gebruikers | Admin',
			users: usersData
		})
	} catch (error) {
		console.error('Error fetching users:', error)
		return renderWithErrorNotification(res, {
			status: 500,
			view: 'admin_users',
			title: 'Gebruikers | Admin',
			message:
				'Gebruikers konden niet worden geladen. Probeer het opnieuw.',
			extra: { users: {} }
		})
	}
}

/**
 * @brief  Summary: Render the admin new-user page.
 * @details  Details: Delegates to the shared page renderer to ensure default locals are always present.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @returns {object} Express response.
 */
export const getUsersNewPage = (req, res) => {
	return renderUserNewPage(res)
}

/**
 * @brief  Summary: Create a new user in Firebase Auth and Realtime Database.
 * @details  Details: Validates and sanitizes incoming form fields, verifies the address via geocoding, creates the auth record, then stores the normalized profile document in Realtime Database with rollback on persistence failure.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @returns {Promise<object>} Express response.
 */
export const postUserNewPage = async (req, res) => {
	const {
		firstName = '',
		lastName = '',
		email = '',
		phoneNumber = '',
		photoURL = '',
		password = ''
	} = req.body

	const safeFirstName = safeTrim(firstName, 100)
	const safeLastName = safeTrim(lastName, 100)
	const safePhoneNumber = safeTrim(phoneNumber, 20)
	const safeEmail = safeTrim(email, 254)
	const safePhotoURL = safeTrim(photoURL, 2048)
	const safePassword = safeTrim(password, 128)
	const fullName = `${safeFirstName} ${safeLastName}`.trim()

	if (!safeFirstName || !safeLastName) {
		return renderUserNewPage(res, {
			status: 400,
			newUser: mapFormDataToNewUser(req.body),
			notifications: [
				createNotification(
					'error',
					'Ongeldige naam',
					'Voornaam en achternaam zijn verplicht.'
				)
			]
		})
	}

	if (!isValidEmail(safeEmail)) {
		return renderUserNewPage(res, {
			status: 400,
			newUser: mapFormDataToNewUser(req.body),
			notifications: [
				createNotification(
					'error',
					'Ongeldig e-mailadres',
					'Geef een geldig e-mailadres op.'
				)
			]
		})
	}

	if (safePassword.length < 6) {
		return renderUserNewPage(res, {
			status: 400,
			newUser: mapFormDataToNewUser(req.body),
			notifications: [
				createNotification(
					'error',
					'Ongeldig wachtwoord',
					'Wachtwoord moet minstens 6 tekens lang zijn.'
				)
			]
		})
	}

	if (!isValidHttpsUrl(safePhotoURL)) {
		return renderUserNewPage(res, {
			status: 400,
			newUser: mapFormDataToNewUser(req.body),
			notifications: [
				createNotification(
					'error',
					'Profielfoto-URL is ongeldig',
					'Profielfoto-URL moet een geldige HTTPS URL zijn.'
				)
			]
		})
	}

	let addressFields
	try {
		addressFields = parseAndValidateAddress(req.body)
	} catch {
		return renderUserNewPage(res, {
			status: 400,
			newUser: mapFormDataToNewUser(req.body),
			notifications: [
				createNotification(
					'error',
					'Ongeldige adresgegevens',
					'Controleer straat, huisnummer, postcode en stad.'
				)
			]
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
			return renderUserNewPage(res, {
				status: 422,
				newUser: mapFormDataToNewUser(req.body),
				notifications: [
					createNotification(
						'error',
						'Adresverificatie mislukt',
						'Het adres kon niet geverifieerd worden. Controleer je gegevens en probeer opnieuw.'
					)
				]
			})
		}

		const normalizedAddress = normalizeGeocodedAddress(
			result.raw,
			addressFields
		)

		const createdAuthUser = await auth.createUser({
			uid: generateRandomUid(),
			email: safeEmail,
			password: safePassword,
			displayName: fullName,
			photoURL: safePhotoURL || undefined,
			emailVerified: false,
			disabled: false
		})

		const userRecord = {
			email: safeEmail,
			phoneNumber: safePhoneNumber,
			photoURL: safePhotoURL,
			emailVerified: false,
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
			createdAt:
				createdAuthUser.metadata.creationTime ||
				new Date().toISOString(),
			lastSignInTime: createdAuthUser.metadata.lastSignInTime || '',
			updatedAt: new Date()
		}

		try {
			await db.ref(`users/${createdAuthUser.uid}`).set(userRecord)
		} catch (error) {
			console.error('Error saving new admin user to database:', error)
			try {
				await auth.deleteUser(createdAuthUser.uid)
			} catch (cleanupError) {
				console.error(
					'Error rolling back created auth user:',
					cleanupError
				)
			}

			return renderUserNewPage(res, {
				status: 500,
				newUser: mapFormDataToNewUser(req.body),
				notifications: [
					createNotification(
						'error',
						'Gebruiker kon niet worden opgeslagen',
						'Er ging iets mis bij het opslaan van de gebruiker. Probeer het opnieuw.'
					)
				]
			})
		}

		return res.redirect(
			`/admin/users/${encodeURIComponent(createdAuthUser.uid)}`
		)
	} catch (error) {
		console.error('Error creating new admin user:', error?.message)
		return renderUserNewPage(res, {
			status: 502,
			newUser: mapFormDataToNewUser(req.body),
			notifications: [
				createNotification(
					'error',
					'Adresverificatie mislukt',
					'Adresverificatie is tijdelijk niet beschikbaar. Probeer later opnieuw.'
				)
			]
		})
	}
}

/**
 * @brief  Summary: Render the admin user detail page.
 * @details  Details: Validates the UID route param, fetches user data from Realtime Database, and renders the detail view with structured fallback errors.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @returns {Promise<object>} Express response.
 */
export const getUserPage = async (req, res) => {
	const { uid } = req.params
	if (!isValidFirebaseUid(uid)) {
		return renderUserDetailError(
			res,
			'admin_user',
			'Gebruiker | Admin',
			400,
			'Ongeldige gebruikers-ID opgegeven.',
			{ userUid: uid, viewUser: {} }
		)
	}

	try {
		const snapshot = await db.ref(`users/${uid}`).once('value')
		const userData = snapshot.val()

		if (!userData) {
			return renderUserDetailError(
				res,
				'admin_user',
				'Gebruiker | Admin',
				404,
				'Deze gebruiker bestaat niet of is verwijderd.',
				{ userUid: uid, viewUser: {} }
			)
		}

		return res.render('admin_user', {
			title: 'Gebruiker | Admin',
			userUid: uid,
			viewUser: userData
		})
	} catch (error) {
		console.error('Error fetching user detail page:', error)
		return renderUserDetailError(
			res,
			'admin_user',
			'Gebruiker | Admin',
			500,
			'Gebruiker kon niet worden geladen. Probeer het opnieuw.',
			{ userUid: uid, viewUser: {} }
		)
	}
}

/**
 * @brief  Summary: Render the admin user edit page.
 * @details  Details: Validates the UID route param, loads existing user data, and renders the edit form with consistent error handling for missing users and database failures.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @returns {Promise<object>} Express response.
 */
export const getUserEditPage = async (req, res) => {
	const { uid } = req.params
	if (!isValidFirebaseUid(uid)) {
		return renderUserDetailError(
			res,
			'admin_user_edit',
			'Bewerk | Gebruikers | Admin',
			400,
			'Ongeldige gebruikers-ID opgegeven.',
			{ userUid: uid, editUser: {} }
		)
	}

	try {
		const snapshot = await db.ref(`users/${uid}`).once('value')
		const userData = snapshot.val()

		if (!userData) {
			return renderUserDetailError(
				res,
				'admin_user_edit',
				'Bewerk | Gebruikers | Admin',
				404,
				'Deze gebruiker bestaat niet of is verwijderd.',
				{ userUid: uid, editUser: {} }
			)
		}

		return res.render('admin_user_edit', {
			title: 'Bewerk | Gebruikers | Admin',
			userUid: uid,
			editUser: userData
		})
	} catch (error) {
		console.error('Error fetching user for edit page:', error)
		return renderUserDetailError(
			res,
			'admin_user_edit',
			'Bewerk | Gebruikers | Admin',
			500,
			'Gebruiker kon niet worden geladen. Probeer het opnieuw.',
			{ userUid: uid, editUser: {} }
		)
	}
}

/**
 * @brief  Summary: Update an existing admin user in Firebase Auth and Realtime Database.
 * @details  Details: Sanitizes form values, validates address fields, geocodes and normalizes coordinates, then persists the updated user profile document in Realtime Database.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @returns {Promise<object>} Express response.
 */
export const postUserEditPage = async (req, res) => {
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

	let addressFields
	try {
		addressFields = parseAndValidateAddress(req.body)
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

	const query = `${addressFields.street} ${addressFields.houseNumber}, ${addressFields.postalCode} ${addressFields.city}`

	try {
		const geocodeResult = await withTimeout(
			(signal) => forwardGeocode(query, signal),
			GEOCODE_TIMEOUT_MS
		)
		const { result } = geocodeResult

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

		const normalizedAddress = normalizeGeocodedAddress(
			result.raw,
			addressFields
		)

		await db.ref(`users/${uid}`).update({
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
		})

		return res.redirect(`/admin/users/${encodeURIComponent(uid)}`)
	} catch (error) {
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
	}
}

/**
 * @brief  Summary: Delete a user from both Realtime Database and Firebase Auth.
 * @details  Details: Validates the UID, removes the profile document from Realtime Database, then removes the corresponding Firebase Auth user.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @returns {Promise<object>} Express response.
 */
export const deleteUserController = async (req, res) => {
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

	try {
		await db.ref(`users/${uid}`).remove()
		await auth.deleteUser(uid)
		return res.redirect('/admin/users')
	} catch (error) {
		console.error('Error deleting user:', error)
		return renderWithErrorNotification(res, {
			status: 500,
			view: 'admin_user',
			title: 'Gebruiker | Admin',
			message:
				'Gebruiker kon niet worden verwijderd. Probeer het opnieuw.',
			extra: {
				userUid: uid,
				viewUser: {}
			}
		})
	}
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

/**
 * @brief  Summary: Resolve the final value from potentially repeated form input.
 * @details  Details: Supports form parsers that can provide arrays for duplicate fields by always selecting the last submitted value.
 * @param {unknown|Array<unknown>} value - Raw form field value.
 * @returns {unknown} The resolved scalar value.
 */
const getLastFormValue = (value) => {
	if (Array.isArray(value)) {
		return value[value.length - 1]
	}

	return value
}

/**
 * @brief  Summary: Parse a raw form value according to a settings field type.
 * @details  Details: Converts booleans, ISO datetime-compatible values, and sanitized strings so settings updates can be persisted safely.
 * @param {'boolean'|'datetime'|'string'} type - Expected input type.
 * @param {unknown} rawValue - Raw submitted value.
 * @returns {boolean|string|null} Parsed setting value.
 */
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

/**
 * @brief  Summary: Merge persisted settings with schema defaults for rendering.
 * @details  Details: Ensures each known settings section exists, preserving stored values while backfilling new defaults and input type definitions.
 * @param {object} settingsData - Persisted settings object from the database.
 * @returns {object} Fully merged settings model for the admin view.
 */
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

/**
 * @brief  Summary: Convert settings form data into a persisted settings payload.
 * @details  Details: Iterates all schema fields, parses submitted values by type, applies checkbox false defaults, and retains existing values when inputs are absent.
 * @param {object} formData - Raw posted settings form data.
 * @param {object} existingSettings - Current persisted settings.
 * @returns {object} Next settings object to save.
 */
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

/**
 * @brief  Summary: Render the admin settings page.
 * @details  Details: Fetches settings from Realtime Database, merges them with defaults for rendering, and falls back to a safe view model on failure.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @returns {Promise<object>} Express response.
 */
export const getSettingsPage = async (req, res) => {
	try {
		const snapshot = await db.ref('settings').once('value')
		const settingsData = snapshot.val() || {}

		return res.render('admin_settings', {
			title: 'Instellingen | Admin',
			settings: buildSettingsViewModel(settingsData)
		})
	} catch (error) {
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
	}
}

/**
 * @brief  Summary: Render the repository documentation browser.
 * @details  Details: Scans the application folders that contain pages, source code, and static documentation, then renders a protected admin overview with folder structure, file metadata, and source previews.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @returns {Promise<object>} Express response.
 */
export const getDocumentationPage = async (req, res) => {
	try {
		const documentation = await buildRepositoryDocumentation()

		return res.render('admin_docs', {
			title: 'Documentatie | Admin',
			documentation
		})
	} catch (error) {
		console.error('Error building repository documentation:', error)
		return res.status(500).render('admin_docs', {
			title: 'Documentatie | Admin',
			documentation: {
				groups: [],
				stats: {
					groupCount: 0,
					fileCount: 0,
					directoryCount: 0,
					lineCount: 0
				}
			},
			notifications: [
				createNotification(
					'error',
					'Documentatie kon niet worden geladen',
					'Probeer de pagina opnieuw te openen.'
				)
			]
		})
	}
}

/**
 * @brief  Summary: Persist admin settings using the incoming form payload.
 * @details  Details: Loads current settings, maps and parses posted form values into the settings schema, updates Realtime Database, and re-renders the page with success or failure notifications.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @returns {Promise<object>} Express response.
 */
export const postSettingsPage = async (req, res) => {
	try {
		const currentSnapshot = await db.ref('settings').once('value')
		const currentSettings = currentSnapshot.val() || {}
		const nextSettings = mapFormDataToSettings(req.body, currentSettings)

		await db.ref('settings').update(nextSettings)

		return res.render('admin_settings', {
			title: 'Instellingen | Admin',
			settings: buildSettingsViewModel(nextSettings),
			notifications: [
				createNotification(
					'success',
					'Succes',
					'Instellingen succesvol opgeslagen.'
				)
			]
		})
	} catch (error) {
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
	}
}
