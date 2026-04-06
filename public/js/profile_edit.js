const streetInput = document.getElementById('street')
const houseNumberInput = document.getElementById('houseNumber')
const postalCodeInput = document.getElementById('postalCode')
const cityInput = document.getElementById('city')
const latitudeInput = document.getElementById('latitude')
const longitudeInput = document.getElementById('longitude')

const latestUpdateInput = document.getElementById('latestUpdate')
const statusElement = document.getElementById('profile-geocode-status')

const addressFields = [
	streetInput,
	houseNumberInput,
	postalCodeInput,
	cityInput
]

const allFieldsFilled = () => {
	return addressFields.every((input) => input.value.trim() !== '')
}

const setStatus = (message) => {
	statusElement.textContent = message
}

const updateCoordinates = (lat, lng) => {
	latitudeInput.value = lat
	longitudeInput.value = lng
}

const updateAddressFields = (raw) => {
	const { housenumber, street, postcode, city } = raw
	streetInput.value = street || ''
	houseNumberInput.value = housenumber || ''
	postalCodeInput.value = postcode || ''
	cityInput.value = city || ''
}

const debounce = (func, delay) => {
	let timeoutId
	return (...args) => {
		clearTimeout(timeoutId)
		timeoutId = setTimeout(() => {
			func.apply(null, args)
		}, delay)
	}
}

const markLatestUpdate = (checked = false) => {
	latestUpdateInput.checked = checked
}

const geocode = async () => {
	if (!allFieldsFilled()) {
		setStatus('Vul alle adresvelden in om automatisch te geocoderen.')
		return
	}

	const address = `${streetInput.value.trim()} ${houseNumberInput.value.trim()}, ${postalCodeInput.value.trim()} ${cityInput.value.trim()}`
	markLatestUpdate(false)
	setStatus('Adres geocoderen...')
	try {
		const response = await fetch(`/api/location/forward-geocode`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ address })
		})
		const data = await response.json()
		if (response.ok && data.lat && data.lon) {
			const { lat, lon, raw } = data
			updateCoordinates(lat, lon)
			updateAddressFields(raw)
			setStatus('Coördinaten bijgewerkt op basis van het adres.')
			markLatestUpdate(true)
		} else {
			if (data.status === 429) {
				setStatus(
					'Te veel geocodingaanvragen. Probeer het later opnieuw.'
				)
				markLatestUpdate(false)
			} else {
				setStatus('Geen resultaten gevonden voor het opgegeven adres.')
				markLatestUpdate(false)
			}
		}
	} catch (error) {
		setStatus('Er is een fout opgetreden bij het geocoderen van het adres.')
		markLatestUpdate(false)
	}
}

const debouncedGeocode = debounce(geocode, 500)

addressFields.forEach((input) => {
	input.addEventListener('input', debouncedGeocode)
})
