/**
 * @file Not-found middleware for unmatched routes.
 * @brief  Sends a 404 response through the shared error response helper.
 * @details  Provides a centralized fallback for unresolved routes and returns a localized not-found message.
 */

import { sendErrorResponse } from './error.middleware.js'

/**
 * @brief  Handle requests that do not match any registered route.
 * @details  Delegates response formatting to the shared error middleware helper using HTTP status 404.
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
