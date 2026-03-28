import { getUserFromSessionCookie } from './auth.service.js'

const SESSION_COOKIE_NAME = 'session'

const shouldReturnJson = (req) => {
	const accepts = req.headers.accept || ''
	return accepts.includes('application/json')
}

export const optionalAuth = async (req, res, next) => {
	try {
		const sessionCookie = req.cookies?.[SESSION_COOKIE_NAME]
		if (sessionCookie) {
			const { data, error } =
				await getUserFromSessionCookie(sessionCookie)
			if (!error && data) {
				req.user = data
			} else {
				res.clearCookie(SESSION_COOKIE_NAME)
			}
		}
		next()
	} catch (error) {
		next(error)
	}
}

export const requireAuth = async (req, res, next) => {
	try {
		const sessionCookie = req.cookies?.[SESSION_COOKIE_NAME]
		if (!sessionCookie) {
			if (shouldReturnJson(req)) {
				return res.status(401).json({ error: 'Unauthorized' })
			}
			return res.redirect('/login')
		}

		const { data, error } = await getUserFromSessionCookie(sessionCookie)
		if (error || !data) {
			res.clearCookie(SESSION_COOKIE_NAME)
			if (shouldReturnJson(req)) {
				return res.status(401).json({ error: 'Unauthorized' })
			}
			return res.redirect('/login')
		}

		req.user = data
		next()
	} catch (error) {
		next(error)
	}
}
