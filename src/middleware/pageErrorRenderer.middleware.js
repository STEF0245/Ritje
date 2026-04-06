const buildPageError = (status, message) => ({ status, message })

const inferViewFromPath = (path) => {
	if (path.startsWith('/api/')) {
		return null
	}

	if (path === '/login') {
		return { view: 'login', title: 'Login' }
	}

	if (path === '/profile/edit') {
		return { view: 'profile-edit', title: 'Bewerk Profiel' }
	}

	if (path === '/profile') {
		return { view: 'profile', title: 'Profiel' }
	}

	if (path === '/admin') {
		return { view: 'admin', title: 'Dashboard | Admin' }
	}

	if (path === '/admin/users') {
		return {
			view: 'admin_users',
			title: 'Gebruikers | Admin',
			extra: { users: {} }
		}
	}

	if (path === '/admin/users/new') {
		return { view: 'admin_users_new', title: 'Nieuw | Gebruikers | Admin' }
	}

	if (path === '/admin/settings') {
		return { view: 'admin_settings', title: 'Instellingen | Admin' }
	}

	if (/^\/admin\/users\/[^/]+$/.test(path)) {
		const userUid = decodeURIComponent(path.split('/').pop() || '')
		return {
			view: 'admin_user_edit',
			title: 'Bewerk | Gebruikers | Admin',
			extra: {
				userUid,
				editUser: {}
			}
		}
	}

	return null
}

export const renderInlinePageError = ({
	req,
	res,
	status,
	message,
	extra = {}
}) => {
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
		...(target.extra || {}),
		...extra
	})

	return true
}

export default renderInlinePageError
