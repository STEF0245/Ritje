/**
 * @file Error middleware for API, HTML, and plain-text responses.
 * @brief  Normalizes runtime and 404 responses across content types.
 * @details  Formats errors according to request content negotiation and protects operational details in production.
 */

import config from '../config.js'
import {
	addNotifications,
	createNotification
} from '../utils/notification.util.js'

/**
 * @brief  Send an error response formatted for the requested content type.
 * @details  Renders HTML error pages when appropriate, returns JSON for API clients, and falls back to plain text for other accept headers.
 * @param {object} params - Error response parameters.
 * @param {object} params.req - Express request object.
 * @param {object} params.res - Express response object.
 * @param {number} params.status - HTTP status code.
 * @param {string} params.message - Error message to deliver.
 * @param {string} [params.title='Er ging iets mis'] - HTML page title.
 * @returns {object} Express response.
 */
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

/**
 * @brief  Express error handling middleware.
 * @details  Normalizes unknown errors to HTTP 500, logs request context, and sends a safe message in production for non-operational errors.
 * @param {Error & {statusCode?: number, isOperational?: boolean}} err - Error instance.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @param {Function} next - Express next middleware callback.
 * @returns {object|void} Sends a formatted error response.
 */
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
