import { config } from '../config/env.config.js'
import { supabase, supabaseAdmin } from '../config/supabase.client.js'
import {
	ACCESS_TOKEN_COOKIE,
	NOTIFY_COOKIE,
	NOTIFY_TYPE_COOKIE,
	REFRESH_TOKEN_COOKIE
} from './auth.constants.js'

const baseCookieOptions = {
	httpOnly: true,
	sameSite: 'lax',
	secure: config.isProduction
}

export const setAuthError = (
	res,
	message,
	type = 'info',
	maxAgeMs = 20 * 1000
) => {
	res.cookie(NOTIFY_COOKIE, message, {
		...baseCookieOptions,
		maxAge: maxAgeMs
	})
	res.cookie(NOTIFY_TYPE_COOKIE, type, {
		...baseCookieOptions,
		maxAge: maxAgeMs
	})
}

export const consumeAuthReason = (req, res) => {
	const authErrorReason = req.cookies[NOTIFY_COOKIE] || null
	if (authErrorReason) {
		res.clearCookie(NOTIFY_COOKIE)
	}

	const authErrorType = req.cookies[NOTIFY_TYPE_COOKIE] || null
	if (authErrorType) {
		res.clearCookie(NOTIFY_TYPE_COOKIE)
	}

	return { authErrorReason, authErrorType }
}

export const setAuthCookies = (res, session) => {
	if (!session?.access_token || !session?.refresh_token) {
		return
	}

	res.cookie(ACCESS_TOKEN_COOKIE, session.access_token, {
		...baseCookieOptions,
		maxAge: (session.expires_in || 3600) * 1000
	})
	res.cookie(REFRESH_TOKEN_COOKIE, session.refresh_token, {
		...baseCookieOptions,
		maxAge: 30 * 24 * 60 * 60 * 1000
	})
}

export const clearAuthCookies = (res) => {
	res.clearCookie(ACCESS_TOKEN_COOKIE)
	res.clearCookie(REFRESH_TOKEN_COOKIE)
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

const BELGIUM_COUNTRY = 'Belgium'

const mapRegisterMetadata = (payload) => ({
	first_name: payload.firstname,
	last_name: payload.lastname,
	full_name: `${payload.firstname || ''} ${payload.lastname || ''}`.trim(),
	display_name: `${payload.firstname || ''} ${payload.lastname || ''}`.trim(),
	address: payload.address,
	street: payload.street,
	house_number: payload.house_number,
	postal_code: payload.postal_code,
	city: payload.city,
	country: BELGIUM_COUNTRY,
	latitude: payload.latitude,
	longitude: payload.longitude
})

export const registerWithPassword = async (payload) => {
	return supabase.auth.signUp({
		email: payload.email,
		password: payload.password,
		options: {
			data: mapRegisterMetadata(payload)
		}
	})
}

export const isLikelyExistingUserSignup = (signupData) => {
	const identities = signupData?.user?.identities
	return Array.isArray(identities) && identities.length === 0
}

export const hasRequiredLoginFields = (payload) => {
	return Boolean(payload?.email && payload?.password)
}

export const loginWithPassword = async (payload) => {
	return supabase.auth.signInWithPassword({
		email: payload.email,
		password: payload.password
	})
}

export const refreshSession = async (refreshToken) => {
	return supabase.auth.refreshSession({
		refresh_token: refreshToken
	})
}

export const getUserFromAccessToken = async (accessToken) => {
	const {
		data: { user },
		error
	} = await supabase.auth.getUser(accessToken)
	if (error) {
		throw error
	}
	return user
}

export const logOut = async (accessToken, scope = 'local') => {
	return supabase.auth.signOut({
		accessToken,
		scope
	})
}

export const updateUserMetadataById = async (userId, userMetadata) => {
	return supabaseAdmin.auth.admin.updateUserById(userId, {
		user_metadata: userMetadata
	})
}
