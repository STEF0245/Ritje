/**
 * @file Notification rendering helpers.
 * @brief  Creates and injects notification payloads into Express views.
 * @details  Centralizes notification creation and rendering helpers so controllers can use consistent view payload structures.
 */

/**
 * @brief  Build a single notification object.
 * @details  Wraps notification field creation to keep notification payloads consistent across controllers.
 * @param {string} type - Notification type (e.g. success, error, warning, info).
 * @param {string} label - Short notification title.
 * @param {string|null} [message=null] - Optional descriptive message.
 * @returns {{type: string, label: string, message: string|null}} Notification object.
 */
const createNotification = (type, label, message = null) => {
	return {
		type,
		label,
		message
	}
}

/**
 * @brief  Respond with a single notification using either render or redirect.
 * @details  Uses a one-time flash cookie when redirecting, or injects notification locals when rendering a view.
 * @param {object} res - Express response object.
 * @param {{type: string, label?: string|null, message?: string|null, status?: number, view?: string, title?: string, extra?: object, redirectTo?: string}} options - Notification response options.
 * @returns {object} Express response.
 */
export const respondWithNotification = (
	res,
	{
		type,
		label = null,
		message = null,
		status = 200,
		view,
		title,
		extra = {},
		redirectTo
	}
) => {
	const notification = createNotification(type, label, message)

	if (redirectTo) {
		setFlashNotification(res, notification)
		return res.redirect(redirectTo)
	}

	if (!view || !title) {
		throw new Error(
			'respondWithNotification requires view and title when redirectTo is not provided.'
		)
	}

	return res.status(status).render(view, {
		title,
		notifications: [notification],
		...extra
	})
}

/**
 * @brief  Store a one-time flash notification in a cookie.
 * @details  Serializes a notification payload so the next request can render it and then clear the cookie.
 * @param {object} res - Express response object.
 * @param {object} notification - Notification payload.
 * @returns {void}
 */
export const setFlashNotification = (res, notification) => {
	res.cookie(
		'flashNotification',
		encodeURIComponent(JSON.stringify(notification)),
		{
			httpOnly: true,
			sameSite: 'strict',
			secure: process.env.NODE_ENV === 'production',
			maxAge: 60 * 1000,
			path: '/'
		}
	)
}
