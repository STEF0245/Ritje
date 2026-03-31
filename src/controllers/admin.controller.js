import db from '../firebase/db.js'

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
				title: 'Gebruiker bewerken | Admin',
				userUid: uid,
				editUser: userData,
				saved: req.query.saved === '1'
			})
		})
		.catch((error) => {
			console.error('Error fetching user for edit page:', error)
			res.status(500).send('Error fetching user')
		})
}

export const postUserEditPage = (req, res) => {
	const { uid } = req.params
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

	const safeFirstName = `${firstName}`.trim()
	const safeLastName = `${lastName}`.trim()
	const safeEmail = `${email}`.trim()
	const safeCity = `${city}`.trim()
	const safeStreet = `${street}`.trim()
	const safeHouseNumber = `${houseNumber}`.trim()
	const safePostalCode = `${postalCode}`.trim()
	const safePhotoURL = `${photoURL}`.trim()
	const fullName = `${safeFirstName} ${safeLastName}`.trim()

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
			res.redirect(`/admin/users/${encodeURIComponent(uid)}?saved=1`)
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
