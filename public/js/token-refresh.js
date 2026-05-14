/**
 * @file Client-side Firebase token refresh utility.
 * @brief  Handles automatic token refresh to prevent session expiration.
 * @details  This module refreshes the Firebase ID token periodically and before API calls.
 *           Firebase tokens expire after 1 hour, so we refresh every 50 minutes to stay ahead of expiration.
 */

import { auth, authReady } from './firebase.js'

// Token refresh interval: 5 minutes (Firebase tokens expire after 1 hour)
const REFRESH_INTERVAL_MS = 5 * 60 * 1000

let refreshTimeout = null

/**
 * @brief  Refresh the Firebase ID token and update server session cookie.
 * @details  Gets a fresh ID token from Firebase and sends it to the server to update the session cookie.
 * @returns {Promise<boolean>} True if refresh succeeded, false otherwise.
 */
export const refreshToken = async () => {
	try {
		const user = auth.currentUser
		if (!user) {
			console.log('No user logged in, skipping token refresh')
			return false
		}

		// Force refresh the token from Firebase
		const newToken = await user.getIdToken(true)
		if (!newToken) {
			console.error('Failed to get new token from Firebase')
			return false
		}

		// Send the new token to the server to update the session cookie
		const response = await fetch('/api/auth/refresh-token', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ idToken: newToken })
		})

		if (!response.ok) {
			console.error(
				'Token refresh failed:',
				response.status,
				response.statusText
			)
			return false
		}

		console.log('Token refreshed successfully')
		return true
	} catch (error) {
		console.error('Error refreshing token:', error.message)
		return false
	}
}

/**
 * @brief  Schedule automatic token refresh.
 * @details  Sets up a periodic refresh that runs every 50 minutes.
 * @returns {void}
 */
export const scheduleTokenRefresh = () => {
	// Clear any existing timeout
	if (refreshTimeout) {
		clearTimeout(refreshTimeout)
	}

	refreshTimeout = setTimeout(() => {
		refreshToken().then(() => {
			// Reschedule the next refresh
			scheduleTokenRefresh()
		})
	}, REFRESH_INTERVAL_MS)
}

/**
 * @brief  Initialize token refresh mechanism.
 * @details  Waits for auth state to be ready, then schedules periodic token refresh.
 * @returns {Promise<void>}
 */
export const initTokenRefresh = async () => {
	try {
		await authReady
		scheduleTokenRefresh()
		console.log('Token refresh initialized')
	} catch (error) {
		console.error('Error initializing token refresh:', error.message)
	}
}

/**
 * @brief  Stop scheduled token refresh.
 * @details  Clears the scheduled refresh timeout.
 * @returns {void}
 */
export const stopTokenRefresh = () => {
	if (refreshTimeout) {
		clearTimeout(refreshTimeout)
		refreshTimeout = null
	}
}

export default {
	refreshToken,
	scheduleTokenRefresh,
	initTokenRefresh,
	stopTokenRefresh
}
