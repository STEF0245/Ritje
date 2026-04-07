import { sendErrorResponse } from './error.middleware.js'

const notFoundHandler = (req, res) => {
	const message = 'De pagina die je zoekt bestaat niet.'

	return sendErrorResponse({
		req,
		res,
		status: 404,
		message,
		title: '404 | Niet gevonden'
	})
}

export default notFoundHandler
