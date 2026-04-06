const buildPageError = (status, message) => ({ status, message })

const inferViewFromPath = (path) => {
	if (path === '/login') {
		return { view: 'login', title: 'Login' }
	}

	if (path === '/profile/edit') {
		return { view: 'profile-edit', title: 'Bewerk Profiel' }
	}

	if (path === '/profile') {
		return { view: 'profile', title: 'Profiel' }
	}

	return null
}

export const renderInlinePageError = ({ req, res, status, message, extra = {} }) => {
	if (!req.accepts('html')) {
		return false
	}

	const target = inferViewFromPath(req.path)
	if (!target) {
		return false
	}

	res.status(status).render(target.view, {
		title: target.title,
		pageError: buildPageError(status, message),
		...extra
	})

	return true
}

export default renderInlinePageError
