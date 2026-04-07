export const createNotification = (type, label, message = null) => {
	return {
		type,
		label,
		message
	}
}

export const addNotifications = (res, notifications = []) => {
	if (!Array.isArray(notifications)) {
		return
	}

	res.locals.notifications = notifications
}
