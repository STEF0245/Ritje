import { forwardGeocode } from '../location/location.service.js'
import { updateUserMetadataById } from '../auth/auth.service.js'

const BELGIUM_COUNTRY = 'Belgium'

const getProfileStatusFeedback = (query) => {
	if (query?.status === 'updated') {
		return {
			authErrorReason: 'Profiel succesvol bijgewerkt.',
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
