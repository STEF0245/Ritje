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
export const createNotification = (type, label, message = null) => {
	return {
		type,
		label,
		message
	}
}

/**
 * @brief  Render a view with normalized notification payloads.
 * @details  Guarantees the `notifications` local is always an array and merges caller-provided extra locals.
 * @param {object} res - Express response object.
 * @param {{status?: number, view: string, title: string, notifications?: Array<object>, extra?: object}} options - Render options.
 * @returns {object} Express response.
 */
export const renderWithNotifications = (
	res,
	{ status = 200, view, title, notifications = [], extra = {} }
) => {
	const safeNotifications = Array.isArray(notifications) ? notifications : []

	return res.status(status).render(view, {
		title,
		notifications: safeNotifications,
		...extra
	})
}

/**
 * @brief  Render a view with a single error notification.
 * @details  Convenience helper around `renderWithNotifications` for the common error scenario.
 * @param {object} res - Express response object.
 * @param {{status: number, view: string, title: string, message: string, label?: string, extra?: object}} options - Error render options.
 * @returns {object} Express response.
 */
export const renderWithErrorNotification = (
	res,
	{ status, view, title, message, label = 'Fout', extra = {} }
) => {
	return renderWithNotifications(res, {
		status,
		view,
		title,
		notifications: [createNotification('error', label, message)],
		extra
	})
}

/**
 * @brief  Attach notifications to response locals.
 * @details  Updates `res.locals.notifications` only when the provided value is an array.
 * @param {object} res - Express response object.
 * @param {Array<object>} [notifications=[]] - Notification list.
 * @returns {void}
 */
export const addNotifications = (res, notifications = []) => {
	if (!Array.isArray(notifications)) {
		return
	}

	res.locals.notifications = notifications
}
