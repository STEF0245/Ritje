/**
 * @file Not-found middleware for unmatched routes.
 * @brief Sends a 404 response through the shared error response helper.
 */

import { sendErrorResponse } from './error.middleware.js'

/**
 * @brief Handle requests that do not match any registered route.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @returns {object} Express response.
 */
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
