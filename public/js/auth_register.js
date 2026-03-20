const fieldIds = ['street', 'house_number', 'postal_code', 'city']
const FIXED_COUNTRY = 'Belgium'
const locationStatus = document.getElementById('location-status')
const locationButton = document.getElementById('autofill-location')
const providerAttributionField = document.getElementById(
	'location-provider-attribution'
)
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

function debounce(func, wait) {
	let timeout
	return function (...args) {
		const later = () => {
			timeout = null
			func.apply(this, args)
		}
		clearTimeout(timeout)
		timeout = setTimeout(later, wait)
	}
}

async function updateCoordinatesFromAddress() {
	if (!addressField.value) {
		latitudeField.value = ''
		longitudeField.value = ''
		return
	}

	const response = await fetch('/api/location/forward-geocode', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ address: addressField.value })
	})

	if (!response.ok) {
		throw new Error('Forward geocoding mislukt')
	}

	const data = await response.json()
	latitudeField.value = data.lat ?? ''
	longitudeField.value = data.lon ?? ''
}

function updateCombinedAddress(usedGeolocation = false) {
	const street = document.getElementById('street').value.trim()
	const houseNumber = document.getElementById('house_number').value.trim()
	const postalCode = document.getElementById('postal_code').value.trim()
	const city = document.getElementById('city').value.trim()

	const lineOne = [street, houseNumber].filter(Boolean).join(' ')
	const lineTwo = [postalCode, city].filter(Boolean).join(' ')

	addressField.value = [lineOne, lineTwo, FIXED_COUNTRY]
		.filter(Boolean)
		.join(', ')

	if (usedGeolocation) return

	updateCoordinatesFromAddress().catch(() => {
		latitudeField.value = ''
		longitudeField.value = ''
	})
}

fieldIds.forEach((id) => {
	document.getElementById(id).addEventListener(
		'input',
		debounce(() => updateCombinedAddress(false), 300)
	)
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

		const response = await fetch('/api/location/reverse-geocode', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				lat: coords.latitude,
				lon: coords.longitude
			})
		})

		if (!response.ok) {
			throw new Error('Reverse geocoding mislukt')
		}

		const data = await response.json()
		const address = data.address || {}
		const providerName =
			data.attribution?.name || data.provider || 'geocoder'
		const providerURL = data.attribution?.url || ''
		const requiredCredit = data.attribution?.requiredCredit || ''

		document.getElementById('street').value = address.street || ''
		document.getElementById('house_number').value =
			address.houseNumber || ''
		document.getElementById('postal_code').value = address.postalCode || ''
		document.getElementById('city').value = address.city || ''

		updateCombinedAddress(true)

		if (providerAttributionField) {
			const providerText = requiredCredit
				? requiredCredit
				: providerURL
					? `Geocoding by ${providerName}: ${providerURL}`
					: `Geocoding by ${providerName}`
			providerAttributionField.textContent = providerText
		}

		locationStatus.innerText = `Adres ingevuld op basis van je locatie (nauwkeurigheid: ${Math.round(coords.accuracy)}m).\r\n Controleer even of alles klopt.`
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
