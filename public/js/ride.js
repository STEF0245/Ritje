/**
 * @file Ride creation UI interactions and route calculation flow.
 * @brief Manages passenger selection, route calculations, and ride persistence.
 * @details Handles checkbox toggling to select/deselect passengers with seat limit enforcement. Provides "Calculate Route" and "Save Route" functionality that communicates with the backend via POST requests. Updates the map display based on calculated routes and selected passengers.
 */

const suggestionsContainer = document.querySelector('[data-ride-suggestions]')
const rideButton = document.getElementById('rideButton')
const mapContainer = document.querySelector('[data-map]')
let mapInstance = null
const checkMapInstance = setInterval(() => {
	mapInstance = mapContainer._appMapInstance || window.appMaps?.[0]
	if (mapInstance) clearInterval(checkMapInstance)
}, 100)

let calculatedThisRoute = false
let thisRouteSaved = false

const initialMarkers = JSON.parse(
	suggestionsContainer.dataset.initialMarkers || '[]'
)
const initialRoute = JSON.parse(
	suggestionsContainer.dataset.initialRoute || 'null'
)

suggestionsContainer.addEventListener('change', () => {
	const allPassengers = suggestionsContainer.querySelectorAll(
		'input[type="checkbox"]'
	)
	const selectedPassengers = suggestionsContainer.querySelectorAll(
		'input[type="checkbox"]:checked'
	)

	rideButton.classList.toggle('hidden!', selectedPassengers.length === 0)

	allPassengers.forEach((checkbox) => {
		if (
			checkbox.checked ||
			selectedPassengers.length < suggestionsContainer.dataset.seatLimit
		) {
			checkbox.disabled = false
		} else {
			checkbox.disabled = true
		}
	})

	calculatedThisRoute = false
	thisRouteSaved = false
	displayOnMap(initialRoute, initialMarkers)
})

rideButton.addEventListener('click', async () => {
	if (!calculatedThisRoute) {
		calculateRoute()
	} else {
		saveRoute()
	}
})

/**
 * @brief  Calculate a route for the currently selected passengers.
 * @details  Sends the selected day, hour, and passenger list to the ride calculation endpoint and updates the map with the returned route and suggestions.
 * @returns {Promise<void>} Resolves when the request has completed.
 */
async function calculateRoute() {
	const passengers = getSelectedPassengers()

	const slot = getSelectedScheduleSlot()
	if (!slot) return

	disableButton(true, 'Berekenen...')
	calculatedThisRoute = true

	try {
		const response = await fetch('/ride/calculate', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ day: slot.day, hour: slot.hour, passengers })
		})
		const result = await response.json()

		if (response.ok) {
			displayOnMap(result.route, result.suggestions)

			disableButton(false, 'Route opslaan')
		} else {
			console.error('Error applying suggestions:', result.message)
			disableButton(false, 'Route berekenen')
		}
	} catch (error) {
		console.error('Error applying suggestions:', error)
		disableButton(false, 'Route berekenen')
	}
}

/**
 * @brief  Persist the currently calculated ride route.
 * @details  Sends the selected schedule slot, route, markers, and passengers to the save endpoint and updates the button state based on the response.
 * @returns {Promise<void>} Resolves when the save request has completed.
 */
async function saveRoute() {
	const slot = getSelectedScheduleSlot()
	if (!slot) return

	const markers = parseJsonDataset(mapContainer.dataset.markers || '[]', [])
	const route = parseJsonDataset(mapContainer.dataset.route || 'null', null)
	const passengers = getSelectedPassengers()

	disableButton(true, 'Opslaan...')

	try {
		const response = await fetch('/ride/save', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				day: slot.day,
				hour: slot.hour,
				passengers,
				route,
				markers
			})
		})
		const result = await response.json()
		if (response.ok) {
			thisRouteSaved = true
			disableButton(true, 'Opgeslagen')
		} else {
			console.error('Error saving route:', result.message)
			disableButton(false, 'Route opslaan')
		}
	} catch (error) {
		console.error('Error saving route:', error)
		disableButton(false, 'Route opslaan')
	}
}

/**
 * @brief  Update the ride action button state.
 * @param {boolean} disabled - Whether the button should be disabled.
 * @param {string} text - Button label to display.
 * @returns {void}
 */
function disableButton(disabled, text) {
	rideButton.disabled = disabled
	rideButton.textContent = text
	rideButton.classList.toggle('opacity-60', disabled)
	rideButton.classList.toggle('cursor-not-allowed!', disabled)
}

/**
 * @brief  Sync the rendered route and markers to the map widget.
 * @param {object|null} route - Route payload to display.
 * @param {Array<object>|null} markers - Marker collection to display.
 * @returns {void}
 */
function displayOnMap(route, markers) {
	if (route) {
		mapContainer.dataset.route = JSON.stringify(route)
		mapInstance.setRoute(route)
	}
	if (markers) {
		mapContainer.dataset.markers = JSON.stringify(markers)
		mapInstance.setMarkers(markers)
	}
}

/**
 * @brief  Read the selected ride schedule slot from the current URL.
 * @details  Extracts the day and hour from the ride edit URL pattern and returns null when the path does not match.
 * @returns {{day: number, hour: number}|null} Selected slot or null.
 */
function getSelectedScheduleSlot() {
	const match = window.location.pathname.match(
		/^\/ride\/(\d+)\/(\d+)\/edit\/?$/
	)
	if (!match) return null

	const day = Number(match[1])
	const hour = Number(match[2])

	if (!Number.isInteger(day) || !Number.isInteger(hour)) return null

	return { day, hour }
}

/**
 * @brief  Parse a JSON value stored in a data attribute.
 * @details  Falls back to the provided default value when parsing fails.
 * @param {string} value - Raw JSON string.
 * @param {unknown} defaultValue - Fallback value.
 * @returns {unknown} Parsed data or the fallback.
 */
function parseJsonDataset(value, defaultValue) {
	try {
		return JSON.parse(value)
	} catch (error) {
		console.error('Error parsing JSON dataset:', error)
		return defaultValue
	}
}

/**
 * @brief  Collect the UIDs for the currently selected passengers.
 * @returns {Array<string>} Selected passenger UIDs.
 */
function getSelectedPassengers() {
	const selectedPassengers = suggestionsContainer.querySelectorAll(
		'input[type="checkbox"]:checked'
	)
	return Array.from(selectedPassengers)
		.map((checkbox) => checkbox.value)
		.filter(Boolean)
}
