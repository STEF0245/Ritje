const notFoundHandler = (req, res) => {
	res.status(404).render('error', {
		title: 'Pagina niet gevonden',
		error: {
			status: 404,
			message: 'De pagina die je zoekt bestaat niet.'
		}
	})
}

export default notFoundHandler
