export const createNotification = (type, label, message = null) => {
	return {
		type,
		label,
		message
	}
}

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

export const addNotifications = (res, notifications = []) => {
	if (!Array.isArray(notifications)) {
		return
	}

	res.locals.notifications = notifications
}
