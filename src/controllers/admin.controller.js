import db from '../firebase/db.js'

export const getAdminPage = (req, res) => {
	res.render('admin', {
		title: 'Admin Dashboard'
	})
}

export const getUsersPage = (req, res) => {
	db.ref('users')
		.once('value')
		.then((snapshot) => {
			const usersData = snapshot.val() || {}
			res.render('admin_users', {
				title: 'Leerkrachten',
				users: usersData
			})
		})
		.catch((error) => {
			console.error('Error fetching users:', error)
			res.status(500).send('Error fetching users')
		})
}
