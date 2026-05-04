/**
 * @file Ride page interactions for selecting suggestions and updating route previews.
 * @brief  Keeps the ride page map in sync with selected suggestion checkboxes.
 */

// ========== DOM ELEMENTS ==========
const radioGroup = document.querySelector('[input-radio-group]')
const suggestionsContainer = document.querySelector('[data-ride-suggestions]')
const calculateButton = document.getElementById('calculateRoute')
const saveButton = document.getElementById('saveRoute')
const mapContainer = document.querySelector('[data-map]')

// ========== STATE ==========
let initialRoute = null
let initialMarkers = []
let currentRide = null
let currentRideRoute = null
let currentRideMarkers = []
let baselineSuggestionSignature = ''
let displayedSuggestionSignature = ''
let activeSuggestionRequest = null
let statusHideTimer = null
let calculateInFlight = false
let saveInFlight = false
let hasCalculatedRoute = false
let hasSavedRoute = false

// ========== CONSTANTS ==========
const seatLimit = Number(suggestionsContainer?.dataset.seatLimit || 1) || 1
const defaultCalculateLabel = 'Route berekenen'
const defaultSaveLabel = 'Route opslaan'
const savedSaveLabel = 'Opgeslagen'
const savingSaveLabel = 'Opslaan...'
const statusAutoHideMs = {
	info: 3500,
	success: 3200,
	warning: 5000,
	error: 6500
}

// ========== EVENT LISTENERS - INITIALIZATION ==========
if (radioGroup) {
	radioGroup.addEventListener('change', (e) => {
		if (e.target.matches('[ride-input]')) {
			const id = e.target.id
			const [day, hour] = id.split('_')
			updateSuggestions(day, hour)
			updateCalculateButtonState()
		}
	})
}

if (calculateButton) {
	calculateButton.addEventListener('click', () => {
		if (calculateInFlight) return
		const selectedSuggestions = suggestionsContainer.querySelectorAll(
			'[data-suggestion-checkbox]:checked'
		)
		const selectedIds = Array.from(selectedSuggestions).map(
			(checkbox) => checkbox.value
		)
		calculateRouteWithSuggestions(selectedIds)
	})
}

if (saveButton) {
	saveButton.addEventListener('click', () => {
		if (saveInFlight || !hasCalculatedRoute || hasSavedRoute) return
		saveCurrentRideRoute()
	})
}

// ========== BUTTON STATE MANAGEMENT ==========
function updateCalculateButtonState() {
	if (!calculateButton) return

	const { selectedCount } = getSelectionState()
	const hasSelection = selectedCount > 0
	const selectionSignature = getSelectedSuggestionSignature()
	const matchesDisplayedRoute =
		hasSelection && selectionSignature === displayedSuggestionSignature
	const shouldRestoreSavedRide =
		hasSelection &&
		selectionSignature === baselineSuggestionSignature &&
		currentRideRoute &&
		displayedSuggestionSignature !== baselineSuggestionSignature
	const shouldShow =
		hasSelection &&
		!calculateInFlight &&
		!matchesDisplayedRoute &&
		!shouldRestoreSavedRide

	calculateButton.classList.toggle('hidden!', !shouldShow)
	calculateButton.textContent = defaultCalculateLabel
	setButtonEnabled(shouldShow)

	if (!hasSelection) {
		hasCalculatedRoute = false
		hasSavedRoute = false
		updateSaveButtonState()
		displayRouteOnMap(initialRoute, initialMarkers)
		displayedSuggestionSignature = ''
		return
	}

	if (shouldRestoreSavedRide) {
		displayRouteOnMap(currentRideRoute, currentRideMarkers)
		displayedSuggestionSignature = baselineSuggestionSignature
	}

	if (matchesDisplayedRoute) {
		calculateButton.disabled = true
	}
}

function setButtonEnabled(enabled = true) {
	if (!calculateButton) return

	calculateButton.disabled = !enabled
	calculateButton.classList.toggle('opacity-60', !enabled)
}

function updateSaveButtonState() {
	if (!saveButton) return

	const shouldShow = hasCalculatedRoute
	saveButton.classList.toggle('hidden!', !shouldShow)

	if (!shouldShow) {
		saveButton.textContent = defaultSaveLabel
		saveButton.disabled = true
		saveButton.classList.add('opacity-60')
		return
	}

	if (hasSavedRoute) {
		saveButton.textContent = savedSaveLabel
		saveButton.disabled = true
		saveButton.classList.add('opacity-60')
		return
	}

	saveButton.textContent = saveInFlight ? savingSaveLabel : defaultSaveLabel
	saveButton.disabled = saveInFlight
	saveButton.classList.toggle('opacity-60', saveInFlight)
}

function getSelectedScheduleSlot() {
	const selected = radioGroup?.querySelector('[ride-input]:checked')
	if (!selected?.id) return null

	const [dayRaw, hourRaw] = selected.id.split('_')
	const day = Number(dayRaw)
	const hour = Number(hourRaw)

	if (!Number.isInteger(day) || !Number.isInteger(hour)) {
		return null
	}

	return { day, hour }
}

function getSelectedSuggestionIds() {
	if (!suggestionsContainer) return []

	const selectedSuggestions = suggestionsContainer.querySelectorAll(
		'[data-suggestion-checkbox]:checked'
	)

	return Array.from(selectedSuggestions)
		.map((checkbox) => checkbox.value)
		.filter(Boolean)
}

function parseJsonDataset(value, fallback) {
	try {
		return JSON.parse(value)
	} catch {
		return fallback
	}
}

function normalizeSuggestionSignature(ids = []) {
	if (!Array.isArray(ids)) return ''

	return Array.from(new Set(ids.map((id) => String(id)).filter(Boolean)))
		.sort()
		.join('|')
}

function getSelectedSuggestionSignature() {
	return normalizeSuggestionSignature(getSelectedSuggestionIds())
}

function setCurrentRideState(ride = null) {
	currentRide = ride || null
	currentRideRoute = currentRide?.route || null
	currentRideMarkers = Array.isArray(currentRide?.markers)
		? currentRide.markers
		: []
	baselineSuggestionSignature = normalizeSuggestionSignature(
		currentRide?.suggestionIds
	)
	displayedSuggestionSignature = baselineSuggestionSignature
}

async function saveCurrentRideRoute() {
	if (!mapContainer) return

	const slot = getSelectedScheduleSlot()
	if (!slot) return

	const route = parseJsonDataset(mapContainer.dataset.route || 'null', null)
	if (!route) {
		// Requested behavior: silently ignore save when no calculated route exists.
		return
	}

	const markers = parseJsonDataset(mapContainer.dataset.markers || '[]', [])
	const suggestionIds = getSelectedSuggestionIds()

	try {
		saveInFlight = true
		updateSaveButtonState()

		const response = await fetch('/ride/save', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				day: slot.day,
				hour: slot.hour,
				suggestionIds,
				route,
				markers
			})
		})

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`)
		}

		const result = await response.json()
		if (!result?.saved) {
			return
		}

		hasSavedRoute = true
		updateSaveButtonState()
	} catch (error) {
		console.error('Error saving ride route:', error)
		showRideStatus('Rit opslaan is mislukt.', 'error')
	} finally {
		saveInFlight = false
		updateSaveButtonState()
	}
}

// ========== STATUS DISPLAY ==========
function hideRideStatus() {
	if (statusHideTimer) {
		clearTimeout(statusHideTimer)
		statusHideTimer = null
	}

	calculateInFlight = false
	updateCalculateButtonState()
}

function showRideStatus(message, tone = 'info', options = {}) {
	if (!calculateButton) return

	if (statusHideTimer) {
		clearTimeout(statusHideTimer)
		statusHideTimer = null
	}

	const autoHideMs = Object.prototype.hasOwnProperty.call(
		options,
		'autoHideMs'
	)
		? options.autoHideMs
		: statusAutoHideMs[tone]

	setButtonEnabled(false)
	calculateButton.textContent = message

	if (typeof autoHideMs === 'number' && autoHideMs > 0) {
		statusHideTimer = setTimeout(() => {
			hideRideStatus()
		}, autoHideMs)
	}
}

// ========== SEAT SELECTION ==========
function getSelectionState() {
	if (!suggestionsContainer) {
		return { selectedCount: 0 }
	}

	const checkboxes = Array.from(
		suggestionsContainer.querySelectorAll('[data-suggestion-checkbox]')
	)
	const selectedCount = checkboxes.filter(
		(checkbox) => checkbox.checked
	).length
	const limitReached = selectedCount >= seatLimit

	for (const checkbox of checkboxes) {
		checkbox.disabled = limitReached && !checkbox.checked
	}

	return { selectedCount }
}

// ========== ROUTE CALCULATION ==========
async function calculateRouteWithSuggestions(suggestionIds) {
	if (calculateInFlight || !suggestionIds.length) return

	const selectionSignature = normalizeSuggestionSignature(suggestionIds)
	if (
		selectionSignature &&
		selectionSignature === displayedSuggestionSignature
	) {
		return
	}

	try {
		calculateInFlight = true
		setButtonEnabled(false)
		showRideStatus('Route wordt berekend...', 'loading')

		const response = await fetch('/ride/calculate', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ suggestionIds })
		})

		if (!response.ok) {
			if (response.status === 429) {
				showRideStatus(
					'Te veel verzoeken. Probeer het later opnieuw.',
					'warning'
				)
				return
			}
			throw new Error(`HTTP ${response.status}`)
		}

		const result = await response.json()
		hasCalculatedRoute = Boolean(result?.route)
		hasSavedRoute = false
		displayedSuggestionSignature = selectionSignature
		updateSaveButtonState()
		displayRouteOnMap(result.route, result.markers, result.cached)
		showRideStatus(
			result.cached ? 'Opgehaald uit cache.' : 'Route geüpdatet.',
			'success'
		)
	} catch (error) {
		console.error('Error calculating route:', error)
		showRideStatus('Route berekenen is mislukt.', 'error')
	} finally {
		calculateInFlight = false
		setButtonEnabled(true)
		updateCalculateButtonState()
	}
}

// ========== MAP MANAGEMENT ==========
function displayRouteOnMap(route, markers, cached = false) {
	if (!mapContainer) return

	const normalizedMarkers = Array.isArray(markers) ? markers : []
	mapContainer.dataset.markers = JSON.stringify(normalizedMarkers)
	mapContainer.dataset.route = JSON.stringify(route)

	const mapInstance = mapContainer._appMapInstance || window.appMaps?.[0]
	if (!mapInstance) return

	mapInstance.setMarkers(normalizedMarkers, { center: true })
	mapInstance.setRoute(route, { center: true })

	if (route) {
		showRideStatus(
			cached ? 'Opgehaald uit cache.' : 'Route geüpdatet.',
			'success'
		)
	}
}

// ========== SUGGESTIONS LOADING ==========
async function updateSuggestions(day, hour) {
	if (!suggestionsContainer) return
	hasCalculatedRoute = false
	hasSavedRoute = false
	updateSaveButtonState()

	if (activeSuggestionRequest) {
		activeSuggestionRequest.abort()
	}

	const controller = new AbortController()
	activeSuggestionRequest = controller
	const params = new URLSearchParams({ day, hour })

	suggestionsContainer.setAttribute('aria-busy', 'true')
	suggestionsContainer.innerHTML =
		'<p class="text-sm theme-text-muted">Suggesties laden...</p>'

	try {
		const response = await fetch(`/ride/suggestions?${params.toString()}`, {
			signal: controller.signal
		})

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`)
		}

		const { suggestions, currentRide } = await response.json()
		setCurrentRideState(currentRide)
		renderSuggestions(suggestions, currentRide)
		if (currentRide?.route) {
			displayRouteOnMap(currentRideRoute, currentRideMarkers)
		}
		getSelectionState()
		updateCalculateButtonState()
	} catch (error) {
		if (error.name === 'AbortError') {
			return
		}

		showRideStatus('Suggesties konden niet worden geladen.', 'error')
		suggestionsContainer.innerHTML =
			'<p class="text-sm theme-text-muted">Suggesties konden niet worden geladen.</p>'
	} finally {
		if (activeSuggestionRequest === controller) {
			activeSuggestionRequest = null
		}
		suggestionsContainer.removeAttribute('aria-busy')
	}
}

// ========== SUGGESTIONS RENDERING ==========
function renderSuggestions(suggestions = [], currentRide = null) {
	if (!suggestionsContainer) return

	suggestionsContainer.innerHTML = ''

	if (!Array.isArray(suggestions) || suggestions.length === 0) {
		suggestionsContainer.innerHTML =
			'<p class="text-sm theme-text-muted">Er zijn geen suggesties beschikbaar.</p>'
		return
	}

	const list = document.createElement('ul')
	list.className = 'space-y-3'

	for (const ride of suggestions) {
		const title = ride?.title || 'Onbekende persoon'
		const addressLine = ride?.lines?.[1] || 'Onbekend adres'
		const detourDistance = Number(
			ride?.detour?.distance ?? ride?.detourDistanceKm
		)
		const detourDuration = Number(
			ride?.detour?.duration ?? ride?.detourDurationMinutes
		)

		const label = document.createElement('label')
		label.className =
			'theme-pill p-4 border theme-border theme-surface ride-suggestion-item cursor-pointer block'

		const input = document.createElement('input')
		input.type = 'checkbox'
		input.className = 'ride-suggestion-check hidden'
		input.setAttribute('data-suggestion-checkbox', '')
		input.value = ride?.uid || ''
		input.setAttribute('aria-label', `Selecteer ${title}`)
		if (currentRide?.suggestionIds?.includes(ride?.uid))
			input.checked = true

		const content = document.createElement('span')
		content.className = 'min-w-0 flex-1'

		const heading = document.createElement('h4')
		heading.className =
			'text-base font-semibold theme-text-primary leading-tight'
		heading.textContent = title

		const address = document.createElement('p')
		address.className = 'text-sm theme-text-muted'
		address.textContent = addressLine

		content.appendChild(heading)
		content.appendChild(address)

		if (
			Number.isFinite(detourDistance) ||
			Number.isFinite(detourDuration)
		) {
			const metrics = document.createElement('div')
			metrics.className = 'mt-2 flex flex-wrap gap-2'

			if (Number.isFinite(detourDistance)) {
				const distanceBadge = document.createElement('span')
				distanceBadge.className =
					'theme-pill border theme-border px-2 py-1 text-xs theme-text-muted'
				distanceBadge.textContent = `+${Math.round(detourDistance * 10) / 10} km`
				metrics.appendChild(distanceBadge)
			}

			if (Number.isFinite(detourDuration)) {
				const durationBadge = document.createElement('span')
				durationBadge.className =
					'theme-pill border theme-border px-2 py-1 text-xs theme-text-muted'
				durationBadge.textContent = `+${Math.round(detourDuration)} min`
				metrics.appendChild(durationBadge)
			}

			content.appendChild(metrics)
		}

		label.appendChild(input)
		label.appendChild(content)
		list.appendChild(label)
	}

	suggestionsContainer.appendChild(list)
	getSelectionState()
}

// ========== SUGGESTIONS CHANGE LISTENER ==========
if (suggestionsContainer) {
	suggestionsContainer.addEventListener('change', (event) => {
		if (!event.target.matches('[data-suggestion-checkbox]')) return
		hasCalculatedRoute = false
		hasSavedRoute = false
		updateSaveButtonState()
		getSelectionState()
		updateCalculateButtonState()
	})
}

// ========== PAGE INITIALIZATION ==========
window.addEventListener('DOMContentLoaded', () => {
	const initialChecked = radioGroup.querySelector('[ride-input]:checked')

	if (mapContainer) {
		try {
			initialMarkers = JSON.parse(mapContainer.dataset.markers || '[]')
		} catch {
			initialMarkers = []
		}
		try {
			initialRoute = JSON.parse(mapContainer.dataset.route || 'null')
		} catch {
			initialRoute = null
		}
	}

	setCurrentRideState(
		parseJsonDataset(suggestionsContainer?.dataset.currentRide || 'null', null)
	)

	if (initialChecked) {
		const [day, hour] = initialChecked.id.split('_')
		updateSuggestions(day, hour)
	} else {
		getSelectionState()
		updateCalculateButtonState()
	}

	updateSaveButtonState()
})
