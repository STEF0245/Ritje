const fieldIds = ['street', 'house_number', 'postal_code', 'city', 'country']
const locationStatus = document.getElementById('location-status')
const locationButton = document.getElementById('autofill-location')
const addressField = document.getElementById('address')
const latitudeField = document.getElementById('latitude')
const longitudeField = document.getElementById('longitude')

function getCurrentAccurateLocation(options = {}) {
	return new Promise((resolve, reject) => {
		if (!navigator.geolocation) {
			reject(new Error('Geolocation is not supported by this browser'))
			return
		}

		let lastCheckedPosition
		let bestCheckedPosition
		let locationEventCount = 0
		let watchID
		let timerID

		if (!options.maxWait) options.maxWait = 10000
		if (!options.desiredAccuracy) options.desiredAccuracy = 20
		if (!options.timeout) options.timeout = options.maxWait

		const checkLocation = (position) => {
			lastCheckedPosition = position

			console.log(
				`Locatie-update #${locationEventCount + 1}: ${position.coords.latitude}, ${position.coords.longitude} (nauwkeurigheid: ${position.coords.accuracy}m)`
			)

			if (
				!bestCheckedPosition ||
				position.coords.accuracy < bestCheckedPosition.coords.accuracy
			) {
				bestCheckedPosition = position
			}

			locationEventCount++

			if (
				position.coords.accuracy <= options.desiredAccuracy &&
				locationEventCount > 1
			) {
				clearTimeout(timerID)
				navigator.geolocation.clearWatch(watchID)
				resolve({
					latitude: position.coords.latitude,
					longitude: position.coords.longitude,
					accuracy: position.coords.accuracy,
					timestamp: position.timestamp
				})
			}
		}

		const stopTrying = () => {
			navigator.geolocation.clearWatch(watchID)
			const bestAvailablePosition =
				bestCheckedPosition || lastCheckedPosition

			if (bestAvailablePosition) {
				resolve({
					latitude: bestAvailablePosition.coords.latitude,
					longitude: bestAvailablePosition.coords.longitude,
					accuracy: bestAvailablePosition.coords.accuracy,
					timestamp: bestAvailablePosition.timestamp
				})
			} else {
				reject(new Error('Could not determine location'))
			}
		}

		const onError = (error) => {
			clearTimeout(timerID)
			navigator.geolocation.clearWatch(watchID)
			reject(error)
		}

		options.maximumAge = 0
		options.enableHighAccuracy = true

		watchID = navigator.geolocation.watchPosition(
			checkLocation,
			onError,
			options
		)
		timerID = setTimeout(stopTrying, options.maxWait)
	})
}

function getLocationCoordinates(address) {
	const encodedAddress = encodeURIComponent(address)
	return fetch(
		`https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}`
	)
		.then((response) => {
			if (!response.ok) {
				throw new Error('Geocoding failed')
			}
			return response.json()
		})
		.then((data) => {
			if (data.length === 0) {
				throw new Error('No results found for the given address')
			}
			return {
				latitude: parseFloat(data[0].lat),
				longitude: parseFloat(data[0].lon)
			}
		})
		.catch((error) => {
			console.error('Error fetching location coordinates:', error)
			throw error
		})
}

function updateCombinedAddress() {
	const street = document.getElementById('street').value.trim()
	const houseNumber = document.getElementById('house_number').value.trim()
	const postalCode = document.getElementById('postal_code').value.trim()
	const city = document.getElementById('city').value.trim()
	const country = document.getElementById('country').value.trim()

	const lineOne = [street, houseNumber].filter(Boolean).join(' ')
	const lineTwo = [postalCode, city].filter(Boolean).join(' ')

	addressField.value = [lineOne, lineTwo, country].filter(Boolean).join(', ')
	getLocationCoordinates(addressField.value)
		.then((coords) => {
			latitudeField.value = coords.latitude
			longitudeField.value = coords.longitude
		})
		.catch((error) => {
			console.error('Error updating coordinates:', error)
			latitudeField.value = ''
			longitudeField.value = ''
		})
}

fieldIds.forEach((id) => {
	document.getElementById(id).addEventListener('input', updateCombinedAddress)
})

locationButton.addEventListener('click', async () => {
	if (!navigator.geolocation) {
		locationStatus.textContent =
			'Geolocatie wordt niet ondersteund door je browser.'
		return
	}

	locationButton.disabled = true
	locationStatus.textContent = 'Nauwkeurige locatie ophalen...'

	try {
		const coords = await getCurrentAccurateLocation({
			maxWait: 5000,
			desiredAccuracy: 20
		})

		latitudeField.value = coords.latitude
		longitudeField.value = coords.longitude

		const response = await fetch(
			`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.latitude}&lon=${coords.longitude}`
		)

		if (!response.ok) {
			throw new Error('Reverse geocoding mislukt')
		}

		const data = await response.json()
		const address = data.address || {}

		document.getElementById('street').value = address.road || ''
		document.getElementById('house_number').value =
			address.house_number || ''
		document.getElementById('postal_code').value = address.postcode || ''
		document.getElementById('city').value =
			address.city || address.town || address.village || ''
		document.getElementById('country').value = address.country || ''

		updateCombinedAddress()
		locationStatus.textContent = `Adres ingevuld op basis van je locatie (nauwkeurigheid: ${Math.round(coords.accuracy)}m). Controleer even of alles klopt.`
	} catch (error) {
		updateCombinedAddress()
		locationStatus.textContent =
			error && error.message === 'Reverse geocoding mislukt'
				? 'Locatie gevonden, maar adres kon niet automatisch worden ingevuld.'
				: 'Toegang tot locatie geweigerd of niet beschikbaar.'
	} finally {
		locationButton.disabled = false
	}
})

updateCombinedAddress()
