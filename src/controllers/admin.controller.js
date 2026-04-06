import db from '../firebase/db.js'

const FIREBASE_UID_PATTERN = /^[A-Za-z0-9_-]{10,128}$/

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
			res.status(500).send('Error fetching users')
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
		return res.status(400).render('error', {
			title: 'Ongeldige gebruiker',
			error: {
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
				return res.status(404).render('error', {
					title: 'Gebruiker niet gevonden',
					message: 'Deze gebruiker bestaat niet of is verwijderd.'
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
			res.status(500).send('Error fetching user')
		})
}

export const postUserEditPage = (req, res) => {
	const { uid } = req.params
	if (!FIREBASE_UID_PATTERN.test(uid)) {
		return res.status(400).render('error', {
			title: 'Ongeldige gebruiker',
			error: {
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
		return res.status(400).render('error', {
			title: 'Ongeldige invoer',
			error: {
				status: 400,
				message: 'Ongeldig e-mailadres opgegeven.'
			}
		})
	}

	if (!isValidPhotoURL(safePhotoURL)) {
		return res.status(400).render('error', {
			title: 'Ongeldige invoer',
			error: {
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
			res.status(500).send('Error updating user')
		})
}

export const getSettingsPage = (req, res) => {
	res.render('admin_settings', {
		title: 'Instellingen | Admin'
	})
}
