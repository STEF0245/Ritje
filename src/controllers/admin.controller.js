import db from '../firebase/db.js'

const FIREBASE_UID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/

const safeTrim = (value, maxLength = 255) => {
	return `${value ?? ''}`.trim().slice(0, maxLength)
}

const isValidPhotoURL = (value) => {
	if (!value) return true
	try {
		const parsed = new URL(value)
		return parsed.protocol === 'https:'
	} catch {
		return false
	}
}

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
			res.status(500).render('admin_users', {
				title: 'Gebruikers | Admin',
				users: {},
				pageError: {
					status: 500,
					message:
						'Gebruikers konden niet worden geladen. Probeer het opnieuw.'
				}
			})
		})
}

export const getUsersNewPage = (req, res) => {
	res.render('admin_users_new', {
		title: 'Nieuw | Gebruikers | Admin'
	})
}

export const getUserEditPage = (req, res) => {
	const { uid } = req.params
	if (!FIREBASE_UID_PATTERN.test(uid)) {
		return res.status(400).render('admin_user_edit', {
			title: 'Bewerk | Gebruikers | Admin',
			userUid: uid,
			editUser: {},
			pageError: {
				status: 400,
				message: 'Ongeldige gebruikers-ID opgegeven.'
			}
		})
	}

	db.ref(`users/${uid}`)
		.once('value')
		.then((snapshot) => {
			const userData = snapshot.val()

			if (!userData) {
				return res.status(404).render('admin_user_edit', {
					title: 'Bewerk | Gebruikers | Admin',
					userUid: uid,
					editUser: {},
					pageError: {
						status: 404,
						message: 'Deze gebruiker bestaat niet of is verwijderd.'
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
			res.status(500).render('admin_user_edit', {
				title: 'Bewerk | Gebruikers | Admin',
				userUid: uid,
				editUser: {},
				pageError: {
					status: 500,
					message:
						'Gebruiker kon niet worden geladen. Probeer het opnieuw.'
				}
			})
		})
}

export const postUserEditPage = (req, res) => {
	const { uid } = req.params
	if (!FIREBASE_UID_PATTERN.test(uid)) {
		return res.status(400).render('admin_user_edit', {
			title: 'Bewerk | Gebruikers | Admin',
			userUid: uid,
			editUser: mapFormDataToEditUser(req.body),
			pageError: {
				status: 400,
				message: 'Ongeldige gebruikers-ID opgegeven.'
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

	if (safeEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeEmail)) {
		return res.status(400).render('admin_user_edit', {
			title: 'Bewerk | Gebruikers | Admin',
			userUid: uid,
			editUser: mapFormDataToEditUser(req.body),
			pageError: {
				status: 400,
				message: 'Ongeldig e-mailadres opgegeven.'
			}
		})
	}

	if (!isValidPhotoURL(safePhotoURL)) {
		return res.status(400).render('admin_user_edit', {
			title: 'Bewerk | Gebruikers | Admin',
			userUid: uid,
			editUser: mapFormDataToEditUser(req.body),
			pageError: {
				status: 400,
				message: 'Profielfoto-URL moet een geldige HTTPS URL zijn.'
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
			res.status(500).render('admin_user_edit', {
				title: 'Bewerk | Gebruikers | Admin',
				userUid: uid,
				editUser: mapFormDataToEditUser(req.body),
				pageError: {
					status: 500,
					message:
						'Gebruiker kon niet worden opgeslagen. Probeer het opnieuw.'
				}
			})
		})
}

export const getSettingsPage = (req, res) => {
	res.render('admin_settings', {
		title: 'Instellingen | Admin'
	})
}
