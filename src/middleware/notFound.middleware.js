import { renderInlinePageError } from './pageErrorRenderer.middleware.js'

const notFoundHandler = (req, res) => {
	const message = 'De pagina die je zoekt bestaat niet.'

	if (renderInlinePageError({ req, res, status: 404, message })) {
		return
	}

	if (req.accepts('json')) {
		return res.status(404).json({
			error: {
				status: 404,
				message
			}
		})
	}

	return res.status(404).type('text/plain').send(message)
}

export default notFoundHandler
