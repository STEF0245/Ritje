import config from '../config.js'
import { renderInlinePageError } from './pageErrorRenderer.middleware.js'

const errorHandler = (err, req, res, next) => {
	err.statusCode = err.statusCode || 500
	err.status = err.status || 'error'
	console.error('Error:', {
		message: err.message,
		statusCode: err.statusCode,
		stack: config.isProduction ? '🔒' : err.stack,
		path: req.path,
		method: req.method
	})

	const safeMessage =
		config.isProduction && !err.isOperational
			? 'Er is een onverwachte fout opgetreden. Probeer het later opnieuw.'
			: err.message

	if (
		renderInlinePageError({
			req,
			res,
			status: err.statusCode,
			message: safeMessage
		})
	) {
		return
	}

	if (req.accepts('json')) {
		return res.status(err.statusCode).json({
			error: {
				status: err.statusCode,
				message: safeMessage
			}
		})
	}

	return res.status(err.statusCode).type('text/plain').send(safeMessage)
}

export default errorHandler
