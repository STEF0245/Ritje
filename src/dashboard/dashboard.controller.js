export const getDashboardPage = (req, res) => {
	res.render('dashboard', {
		title: 'Dashboard'
	})
}
