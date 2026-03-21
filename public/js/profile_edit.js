const REQUIRED_FIELD_IDS = ['street', 'house_number', 'postal_code', 'city']
const FIXED_COUNTRY = 'Belgium'

const addressField = document.getElementById('address')
const latitudeField = document.getElementById('latitude')
const longitudeField = document.getElementById('longitude')
const statusField = document.getElementById('profile-geocode-status')

const setStatus = (message, isError = false) => {
	if (!statusField) {
		return
	}

	statusField.textContent = message
	statusField.classList.toggle('text-amber-300', isError)
	statusField.classList.toggle('theme-text-muted', !isError)
}

const getAddressParts = () => {
	const street = document.getElementById('street')?.value?.trim() || ''
	const houseNumber =
		document.getElementById('house_number')?.value?.trim() || ''
	const postalCode =
		document.getElementById('postal_code')?.value?.trim() || ''
	const city = document.getElementById('city')?.value?.trim() || ''

	return { street, houseNumber, postalCode, city }
}

const composeAddress = ({ street, houseNumber, postalCode, city }) => {
	const lineOne = [street, houseNumber].filter(Boolean).join(' ')
	const lineTwo = [postalCode, city].filter(Boolean).join(' ')
	return [lineOne, lineTwo, FIXED_COUNTRY].filter(Boolean).join(', ')
}

const hasAllRequiredFields = ({ street, houseNumber, postalCode, city }) => {
	return Boolean(street && houseNumber && postalCode && city)
}

const debounce = (func, wait) => {
	let timeoutId
	return (...args) => {
		clearTimeout(timeoutId)
		timeoutId = setTimeout(() => func(...args), wait)
	}
}

const updateCoordinatesFromAddress = async () => {
	const addressParts = getAddressParts()
	const composedAddress = composeAddress(addressParts)
	addressField.value = composedAddress

	if (!hasAllRequiredFields(addressParts)) {
		latitudeField.value = ''
		longitudeField.value = ''
		setStatus(
			'Vul straat, nummer, postcode en stad in voor automatische coördinaten.'
		)
		return
	}

	setStatus('Adres controleren en coördinaten bijwerken...')

	try {
		const response = await fetch('/api/location/forward-geocode', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ address: composedAddress })
		})

		if (!response.ok) {
			throw new Error('Forward geocode request failed')
		}

		const data = await response.json()
		latitudeField.value = data.lat || ''
		longitudeField.value = data.lon || ''
		setStatus('Coördinaten automatisch bijgewerkt op basis van je adres.')
	} catch {
		latitudeField.value = ''
		longitudeField.value = ''
		setStatus(
			'Adres kon niet automatisch worden omgezet naar coördinaten. Controleer je adres.',
			true
		)
	}
}

const debouncedUpdateCoordinatesFromAddress = debounce(
	updateCoordinatesFromAddress,
	350
)

REQUIRED_FIELD_IDS.forEach((id) => {
	const field = document.getElementById(id)
	if (!field) {
		return
	}

	field.addEventListener('blur', debouncedUpdateCoordinatesFromAddress)
})

updateCoordinatesFromAddress()
