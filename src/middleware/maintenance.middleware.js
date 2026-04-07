/**
 * @file Maintenance mode middleware backed by live Firebase settings.
 * @brief Blocks non-admin traffic while the maintenance flag is enabled.
 * @details Maintains an in-memory snapshot of maintenance settings and uses it to short-circuit requests when maintenance mode is active.
 */

import db from '../firebase/db.js'

const DEFAULT_MAINTENANCE = {
	enabled: false,
	message: 'De site is tijdelijk in onderhoud. Probeer het later opnieuw.',
	startTime: null,
	endTime: null,
	updatedAt: null
}

const settings = {
	maintenance: { ...DEFAULT_MAINTENANCE }
}

/**
 * @brief Normalize persisted maintenance settings into the expected shape.
 * @details Supports legacy keys and ensures boolean fields are properly coerced while inheriting defaults.
 * @param {object} [data={}] - Raw settings payload from Realtime Database.
 * @returns {{enabled: boolean, message: string, startTime: string|null, endTime: string|null, updatedAt: string|null}} Normalized maintenance settings.
 */
const normalizeMaintenanceSettings = (data = {}) => {
	const source = data.maintenance || data.maintenanceMode || {}

	return {
		...DEFAULT_MAINTENANCE,
		...source,
		enabled: Boolean(source.enabled)
	}
}

/**
 * @brief Start the realtime listener that keeps maintenance settings fresh.
 * @details Subscribes to the `settings` path and updates the in-memory settings snapshot whenever values change.
 * @returns {void}
 */
const initSettings = () => {
	try {
		db.ref('settings').on('value', (snapshot) => {
			const data = snapshot.val()
			settings.maintenance = normalizeMaintenanceSettings(data || {})
		})
	} catch (error) {
		console.error('Error initializing settings:', error)
	}
}

initSettings()

/**
 * @brief Short-circuit requests when maintenance mode is active.
 * @details Allows normal traffic when maintenance is off, optionally allows admin access, and renders the maintenance page for blocked requests.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @param {Function} next - Express next middleware callback.
 * @returns {Promise<void>} Resolves when the request can continue.
 */
const checkMaintenanceMode = async (req, res, next) => {
	try {
		if (
			!settings?.maintenance?.enabled ||
			(req?.user?.isAdmin &&
				(settings?.maintenance?.allowAdminAccess ||
					req?.url?.startsWith('/admin')))
		) {
			return next()
		}

		res.setHeader('Retry-After', '3600')

		return res.status(503).render('maintenance', {
			title: 'Onderhoud',
			message: settings?.maintenance?.message,
			startTime: settings?.maintenance?.startTime,
			endTime: settings?.maintenance?.endTime
		})
	} catch (error) {
		console.error('Error checking maintenance mode:', error)
		return next()
	}
}

export default checkMaintenanceMode
