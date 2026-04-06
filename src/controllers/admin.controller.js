import db from '../firebase/db.js'
import { safeTrim, isValidHttpsUrl, isValidEmail } from '../utils/input.util.js'
import { isValidFirebaseUid } from '../utils/firebase.util.js'
import { renderWithPageError } from '../utils/page-error.util.js'

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
			return renderWithPageError(res, {
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
		return renderWithPageError(res, {
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
				return renderWithPageError(res, {
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
			return renderWithPageError(res, {
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
		return renderWithPageError(res, {
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
		city = '',
		street = '',
		houseNumber = '',
		postalCode = '',
		photoURL = ''
	} = req.body

	const safeFirstName = safeTrim(firstName, 100)
	const safeLastName = safeTrim(lastName, 100)
	const safeEmail = safeTrim(email, 254)
	const safeCity = safeTrim(city, 100)
	const safeStreet = safeTrim(street, 120)
	const safeHouseNumber = safeTrim(houseNumber, 20)
	const safePostalCode = safeTrim(postalCode, 20)
	const safePhotoURL = safeTrim(photoURL, 2048)
	const fullName = `${safeFirstName} ${safeLastName}`.trim()

	if (safeEmail && !isValidEmail(safeEmail)) {
		return renderWithPageError(res, {
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
		return renderWithPageError(res, {
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
			return renderWithPageError(res, {
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

export const getSettingsPage = (req, res) => {
	res.render('admin_settings', {
		title: 'Instellingen | Admin'
	})
}
