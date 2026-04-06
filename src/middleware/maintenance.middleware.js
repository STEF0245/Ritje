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

const normalizeMaintenanceSettings = (data = {}) => {
	const source = data.maintenance || data.maintenanceMode || {}

	return {
		...DEFAULT_MAINTENANCE,
		...source,
		enabled: Boolean(source.enabled)
	}
}

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

const checkMaintenanceMode = async (req, res, next) => {
	try {
		if (!settings?.maintenance?.enabled) {
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
