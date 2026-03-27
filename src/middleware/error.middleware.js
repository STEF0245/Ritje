import path from 'path'
import config from '../config.js'

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

	res.status(err.statusCode).render('error', {
		title: `Error ${err.statusCode}`,
		error: {
			status: err.statusCode,
			message:
				config.isProduction && !err.isOperational
					? 'Er is een onverwachte fout opgetreden. Probeer het later opnieuw.'
					: err.message
		}
	})
}

export default errorHandler
