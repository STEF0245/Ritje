import config from '../config.js'
import {
	addNotifications,
	createNotification
} from '../utils/notification.util.js'

export const sendErrorResponse = ({
	req,
	res,
	status,
	message,
	title = 'Er ging iets mis'
}) => {
	if (req.accepts('html')) {
		addNotifications(res, [createNotification('error', 'Fout', message)])
		return res.status(status).render('error', {
			title,
			error: {
				status,
				message
			}
		})
	}

	if (req.accepts('json')) {
		return res.status(status).json({
			error: {
				status,
				message
			}
		})
	}

	return res.status(status).type('text/plain').send(message)
}

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

	return sendErrorResponse({
		req,
		res,
		status: err.statusCode,
		message: safeMessage,
		title: `${err.statusCode} | Fout`
	})
}

export default errorHandler
