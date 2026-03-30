import db from '../firebase/db.js'

export const getAdminPage = (req, res) => {
	res.render('admin', {
		title: 'Admin Dashboard'
	})
}

export const getUsersPage = (req, res) => {
	const users = db
		.ref('users')
		.once('value')
		.then((snapshot) => {
			const usersData = snapshot.val() || {}
			res.render('users_admin', {
				title: 'Leerkrachten',
				users: usersData
			})
		})
		.catch((error) => {
			console.error('Error fetching users:', error)
			res.status(500).send('Error fetching users')
		})
}
