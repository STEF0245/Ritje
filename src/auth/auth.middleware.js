import { getUserByUid } from './auth.service.js'

export const optionalAuth = async (req, res, next) => {
	try {
		const uid = req.headers.authorization?.split(' ')[1]
		if (uid) {
			const user = await getUserByUid(uid)
			req.user = user
		}
		next()
	} catch (error) {
		next(error)
	}
}

export const requireAuth = async (req, res, next) => {
	try {
		const uid = req.headers.authorization?.split(' ')[1]
		if (!uid) {
			return res.status(401).json({ error: 'Unauthorized' })
		}
		const user = await getUserByUid(uid)
		req.user = user
		next()
	} catch (error) {
		next(error)
	}
}
