export const errorHandler = (err, req, res, next) => {
	err.statusCode = err.statusCode || 500
	err.status = err.status || 'error'

	// Log error
	console.error('Error:', {
		message: err.message,
		statusCode: err.statusCode,
		stack: config.isProduction ? '🔒' : err.stack,
		path: req.path,
		method: req.method
	})

	// Send error response
	res.status(err.statusCode).render('error', {
		title: 'Oeps, er ging iets mis',
		error: {
			status: err.statusCode,
			message:
				config.isProduction && !err.isOperational
					? 'Er is een onverwachte fout opgetreden. Probeer het later opnieuw.'
					: err.message
		}
	})
}

export const notFoundHandler = (req, res) => {
	res.status(404).render('404', {
		title: 'Oei, deze weg loopt dood'
	})
}
