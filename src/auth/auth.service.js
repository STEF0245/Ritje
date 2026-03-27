import auth from '../firebase/auth.js'
import db from '../firebase/db.js'
import { generateShortUid } from '../misc/id.util.js'

const createUserWithRetry = async (userData, attempts = 0) => {
	if (attempts > 5)
		throw new Error('Failed to generate a unique UID after 5 attempts.')

	const uid = generateShortUid()
	try {
		return await auth.createUser({ ...userData, uid })
	} catch (error) {
		// If the UID exists, try again
		if (error.code === 'auth/uid-already-exists') {
			return createUserWithRetry(userData, attempts + 1)
		}
		throw error // Propagate other errors (email already exists, etc.)
	}
}

export const registerWithPassword = async (data) => {
	try {
		const email = data.email
		const password = data.password
		const phoneNumber = data.phoneNumber || null
		const firstName = data.firstName || ''
		const lastName = data.lastName || ''
		const photoURL = data.photoURL || null
		const address = data.address || {}
		const displayName = `${firstName} ${lastName}`

		const userRecord = await createUserWithRetry({
			email,
			password,
			phoneNumber,
			photoURL,
			displayName
		})

		await db.ref(`users/${userRecord.uid}`).set({
			email,
			phoneNumber,
			firstName,
			lastName,
			photoURL,
			createdAt: Date.now(),
			address
		})

		return { data: userRecord.toJSON(), error: null }
	} catch (error) {
		console.error('Error creating user:', error)
		return { data: null, error: error.message }
	}
}

export const signIn = async (req, res) => {
	try {
		const idToken = req.body.idToken.toString()
		const csrfToken = req.body.csrfToken.toString()
		if (csrfToken !== req.cookies.csrfToken) {
			res.status(401).send('Unauthorized')
			return { data: null, error: 'Invalid CSRF token' }
		}

		const expiresIn = 60 * 60 * 24 * 5 * 1000 // 5 days
		const sessionCookie = await auth.createSessionCookie(idToken, {
			expiresIn
		})
		const options = { maxAge: expiresIn, httpOnly: true, secure: true }
		res.cookie('session', sessionCookie, options)
		res.end(JSON.stringify({ status: 'success' }))
		return { data: true, error: null }
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

export const updateUser = async (uid, updates) => {
	try {
		const userRecord = await auth.updateUser(uid, updates)
		return { data: userRecord.toJSON(), error: null }
	} catch (error) {
		return { data: null, error: error.message }
	}
}

export const getUserByUid = async (uid) => {
	try {
		const userRecord = await auth.getUser(uid)
		return { data: userRecord.toJSON(), error: null }
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
		res.clearCookie('session').redirect('/login')
		return { data: true, error: null }
	} catch (error) {
		return { data: null, error: error.message }
	}
}

export const hasRequiredRegisterFields = (payload) => {
	return Boolean(
		payload?.email &&
		payload?.password &&
		payload?.firstname &&
		payload?.lastname &&
		payload?.street &&
		payload?.house_number &&
		payload?.postal_code &&
		payload?.city &&
		payload?.address &&
		payload?.latitude &&
		payload?.longitude
	)
}

export const hasRequiredLoginFields = (payload) => {
	return Boolean(payload?.email && payload?.password)
}
