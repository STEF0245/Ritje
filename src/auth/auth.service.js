import auth from '../firebase/auth.js'
import db from '../firebase/db.js'
import { config } from '../config/env.config.js'

const SESSION_COOKIE_NAME = 'session'
const CSRF_COOKIE_NAME = 'csrfToken'
const SESSION_DURATION_MS = 60 * 60 * 24 * 5 * 1000 // 5 days

const getCookieOptions = (maxAge) => ({
	httpOnly: true,
	secure: config.isProduction,
	sameSite: 'lax',
	maxAge
})

const toPublicUser = async (userRecord) => {
	const snapshot = await db.ref(`users/${userRecord.uid}`).get()
	const profile = snapshot.exists() ? snapshot.val() : {}
	const firstName = profile.first_name || profile.firstName || ''
	const lastName = profile.last_name || profile.lastName || ''
	const fullName =
		profile.full_name ||
		profile.display_name ||
		[firstName, lastName].filter(Boolean).join(' ') ||
		userRecord.displayName ||
		''

	return {
		id: userRecord.uid,
		uid: userRecord.uid,
		email: userRecord.email || profile.email || null,
		phone: userRecord.phoneNumber || profile.phone_number || null,
		created_at:
			userRecord.metadata?.creationTime || profile.created_at || null,
		updated_at: profile.updated_at || null,
		last_sign_in_at: userRecord.metadata?.lastSignInTime || null,
		email_confirmed_at: userRecord.emailVerified
			? userRecord.metadata?.lastRefreshTime ||
				userRecord.metadata?.creationTime
			: null,
		app_metadata: userRecord.customClaims || {},
		user_metadata: {
			first_name: firstName,
			last_name: lastName,
			full_name: fullName,
			display_name: fullName,
			street: profile.street || profile.address?.street || '',
			house_number:
				profile.house_number || profile.address?.house_number || '',
			postal_code:
				profile.postal_code || profile.address?.postal_code || '',
			city: profile.city || profile.address?.city || '',
			country: profile.country || profile.address?.country || 'Belgium',
			address: profile.address || profile.address?.address || '',
			latitude: profile.latitude || profile.address?.latitude || '',
			longitude: profile.longitude || profile.address?.longitude || '',
			weekly_schedule: profile.weekly_schedule || {}
		}
	}
}

export const signIn = async (req, res) => {
	try {
		const idToken = String(req.body?.idToken || '')
		const csrfToken = String(req.body?.csrfToken || '')
		if (csrfToken !== req.cookies.csrfToken) {
			return { data: null, error: 'Invalid CSRF token' }
		}

		await auth.verifyIdToken(idToken, true)

		const sessionCookie = await auth.createSessionCookie(idToken, {
			expiresIn: SESSION_DURATION_MS
		})

		res.cookie(
			SESSION_COOKIE_NAME,
			sessionCookie,
			getCookieOptions(SESSION_DURATION_MS)
		)
		res.clearCookie(CSRF_COOKIE_NAME)

		return { data: { session: true }, error: null }
	} catch (error) {
		console.error('Login error:', error)
		return { data: null, error: error.message }
	}
}

export const createUserToken = async (uid) => {
	try {
		const token = await auth.createCustomToken(uid)
		return { data: token, error: null }
	} catch (error) {
		return { data: null, error: error.message }
	}
}

export const getUserByUid = async (uid) => {
	try {
		const userRecord = await auth.getUser(uid)
		const user = await toPublicUser(userRecord)
		return { data: user, error: null }
	} catch (error) {
		return { data: null, error: error.message }
	}
}

export const getUserByEmail = async (email) => {
	try {
		const userRecord = await auth.getUserByEmail(email)
		return { data: userRecord.toJSON(), error: null }
	} catch (error) {
		return { data: null, error: error.message }
	}
}

export const signOut = (req, res) => {
	try {
		res.clearCookie(SESSION_COOKIE_NAME)
		res.clearCookie(CSRF_COOKIE_NAME)
		return { data: true, error: null }
	} catch (error) {
		return { data: null, error: error.message }
	}
}

export const getUserFromSessionCookie = async (sessionCookie) => {
	try {
		const decodedToken = await auth.verifySessionCookie(sessionCookie, true)
		return getUserByUid(decodedToken.uid)
	} catch (error) {
		return { data: null, error: error.message }
	}
}

export const hasRequiredLoginFields = (payload) => {
	return Boolean(payload?.idToken && payload?.csrfToken)
}
