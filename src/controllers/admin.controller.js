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

export const getUserAddPage = (req, res) => {
	res.render('admin_users_add', {
		title: 'Toevoegen | Gebruikers | Admin'
	})
}

export const getSettingsPage = (req, res) => {
	res.render('admin_settings', {
		title: 'Instellingen | Admin'
	})
}
