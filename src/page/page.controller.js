import { forwardGeocode } from '../location/location.service.js'
import { updateUserMetadataById } from '../auth/auth.service.js'

const BELGIUM_COUNTRY = 'Belgium'
const CLASS_BOUNDARY_TIMES = [
	'08:25',
	'09:15',
	'10:05',
	'10:20',
	'11:10',
	'12:00',
	'13:00',
	'13:50',
	'14:40',
	'14:55',
	'15:45',
	'16:35'
]
const SCHEDULE_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']

const isValidTime = (value) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(value)

const toMinutes = (value) => {
	const [hours, minutes] = value.split(':').map(Number)
	return hours * 60 + minutes
}

const isClassBoundaryTime = (value) => CLASS_BOUNDARY_TIMES.includes(value)

const getBoundTimeFromPayload = (payload, day, bound) => {
	const directValue = String(
		payload?.[`schedule_${day}_${bound}`] || ''
	).trim()
	if (directValue) {
		return directValue
	}

	const hour = String(payload?.[`schedule_${day}_${bound}_hour`] || '').trim()
	const minute = String(
		payload?.[`schedule_${day}_${bound}_minute`] || ''
	).trim()

	if (!hour && !minute) {
		return ''
	}

	if (!hour || !minute) {
		return `${hour}:${minute}`
	}

	return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`
}

const parseScheduleFromPayload = (payload) => {
	const schedule = {}

	for (const day of SCHEDULE_DAYS) {
		const start = getBoundTimeFromPayload(payload, day, 'start')
		const end = getBoundTimeFromPayload(payload, day, 'end')

		if (!start && !end) {
			schedule[day] = null
			continue
		}

		if (
			!start ||
			!end ||
			!isValidTime(start) ||
			!isValidTime(end) ||
			!isClassBoundaryTime(start) ||
			!isClassBoundaryTime(end) ||
			toMinutes(start) >= toMinutes(end)
		) {
			return {
				schedule: null,
				hasError: true
			}
		}

		schedule[day] = {
			start,
			end
		}
	}

	return {
		schedule,
		hasError: false
	}
}

const getProfileStatusFeedback = (query) => {
	if (query?.status === 'updated') {
		return {
			authErrorReason: 'Profiel succesvol bijgewerkt.',
			authErrorType: 'info'
		}
	}

	if (query?.status === 'schedule_updated') {
		return {
			authErrorReason: 'Urenrooster succesvol bijgewerkt.',
			authErrorType: 'info'
		}
	}

	if (query?.error === 'missing_fields') {
		return {
			authErrorReason:
				'Vul alle verplichte velden in: voornaam, achternaam, straat, nummer, postcode en stad.',
			authErrorType: 'error'
		}
	}

	if (query?.error === 'geocode_failed') {
		return {
			authErrorReason:
				'Adres kon niet gevonden worden. Controleer straat, nummer, postcode en stad.',
			authErrorType: 'error'
		}
	}

	if (query?.error === 'save_failed') {
		return {
			authErrorReason:
				'Opslaan van je profiel is mislukt. Probeer het opnieuw.',
			authErrorType: 'error'
		}
	}

	if (query?.error === 'schedule_invalid') {
		return {
			authErrorReason:
				'Controleer je urenrooster. Kies enkel officiële lesstart/leseinde tijden en zorg dat einduur later is dan beginuur.',
			authErrorType: 'error'
		}
	}

	return {
		authErrorReason: null,
		authErrorType: null
	}
}

export const getProfilePage = (req, res) => {
	const { authErrorReason, authErrorType } = getProfileStatusFeedback(
		req.query
	)

	res.render('profile', {
		title: 'Mijn Profiel',
		authErrorReason,
		authErrorType
	})
}

export const getProfileEditPage = (req, res) => {
	const { authErrorReason, authErrorType } = getProfileStatusFeedback(
		req.query
	)

	res.render('profile', {
		title: 'Profiel Bewerken',
		isEditMode: true,
		authErrorReason,
		authErrorType
	})
}

export const postProfileEditPage = async (req, res) => {
	try {
		const formType = String(req.body?.form_type || 'profile').trim()

		if (formType === 'schedule') {
			const { schedule, hasError } = parseScheduleFromPayload(req.body)

			if (hasError) {
				return res.redirect('/profile/edit?error=schedule_invalid')
			}

			const existingMetadata = req.user?.user_metadata || {}
			const mergedMetadata = {
				...existingMetadata,
				weekly_schedule: schedule
			}

			const { error } = await updateUserMetadataById(
				req.user.id,
				mergedMetadata
			)

			if (error) {
				console.error('Schedule update failed:', error)
				return res.redirect('/profile/edit?error=save_failed')
			}

			return res.redirect('/profile?status=schedule_updated')
		}

		const firstName = String(req.body?.first_name || '').trim()
		const lastName = String(req.body?.last_name || '').trim()
		const street = String(req.body?.street || '').trim()
		const houseNumber = String(req.body?.house_number || '').trim()
		const postalCode = String(req.body?.postal_code || '').trim()
		const city = String(req.body?.city || '').trim()

		if (
			!firstName ||
			!lastName ||
			!street ||
			!houseNumber ||
			!postalCode ||
			!city
		) {
			return res.redirect('/profile/edit?error=missing_fields')
		}

		const composedAddress = `${street} ${houseNumber}, ${postalCode} ${city}, ${BELGIUM_COUNTRY}`
		const { result } = await forwardGeocode(composedAddress)

		if (!result?.lat || !result?.lon) {
			return res.redirect('/profile/edit?error=geocode_failed')
		}

		const existingMetadata = req.user?.user_metadata || {}
		const mergedMetadata = {
			...existingMetadata,
			first_name: firstName,
			last_name: lastName,
			full_name: `${firstName} ${lastName}`.trim(),
			display_name: `${firstName} ${lastName}`.trim(),
			street,
			house_number: houseNumber,
			postal_code: postalCode,
			city,
			country: BELGIUM_COUNTRY,
			address: composedAddress,
			latitude: result.lat,
			longitude: result.lon
		}

		const { error } = await updateUserMetadataById(
			req.user.id,
			mergedMetadata
		)

		if (error) {
			console.error('Profile update failed:', error)
			return res.redirect('/profile/edit?error=save_failed')
		}

		return res.redirect('/profile?status=updated')
	} catch (error) {
		console.error('Profile edit route error:', error)
		return res.redirect('/profile/edit?error=save_failed')
	}
}
