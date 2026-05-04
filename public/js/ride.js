/**
 * @file Ride page interactions for selecting suggestions and updating route previews.
 * @brief  Keeps the ride page map in sync with selected suggestion checkboxes.
 */

const radioGroup = document.querySelector('[input-radio-group]')
const suggestionsContainer = document.querySelector('[data-ride-suggestions]')
const recalculateButton = document.getElementById('routeRecalculate')
const mapContainer = document.querySelector('[data-map]')
const map = mapContainer ? mapContainer._appMapInstance : null
let initialRoute = null
let initialMarkers = []
let activeSuggestionRequest = null

if (radioGroup) {
	radioGroup.addEventListener('change', (e) => {
		if (e.target.matches('[ride-input]')) {
			const id = e.target.id
			const [day, hour] = id.split('_')
			updateSuggestions(day, hour)
		}
	})
}

if (suggestionsContainer) {
	suggestionsContainer.addEventListener('change', (e) => {
		if (e.target.matches('[data-suggestion-checkbox]')) {
			toggleRecalculateButton()
		}
	})
}

if (recalculateButton) {
	recalculateButton.addEventListener('click', () => {
		const selectedSuggestions = suggestionsContainer.querySelectorAll(
			'[data-suggestion-checkbox]:checked'
		)
		const selectedIds = Array.from(selectedSuggestions).map(
			(checkbox) => checkbox.value
		)
		console.log('Selected suggestion IDs:', selectedIds)
		recalculateRouteWithSuggestions(selectedIds)
	})
}

async function toggleRecalculateButton() {
	if (!recalculateButton) return

	const anyChecked = suggestionsContainer.querySelector(
		'[data-suggestion-checkbox]:checked'
	)
	recalculateButton.classList.toggle('hidden!', !anyChecked)
	if (!anyChecked) {
		// Restore initial map state locally without calling the backend
		displayRouteOnMap(initialRoute, initialMarkers)
		return
	}
}

let recalcInFlight = false

function ensureRouteStatusElement() {
	let el = document.getElementById('routeStatus')
	if (!el && recalculateButton && recalculateButton.parentNode) {
		el = document.createElement('span')
		el.id = 'routeStatus'
		el.className = 'text-sm theme-text-muted ml-3'
		recalculateButton.parentNode.insertBefore(
			el,
			recalculateButton.nextSibling
		)
	}
	return el
}

async function recalculateRouteWithSuggestions(suggestionIds) {
	if (recalcInFlight) return
	const statusEl = ensureRouteStatusElement()
	try {
		recalcInFlight = true
		if (recalculateButton) {
			recalculateButton.disabled = true
			recalculateButton.classList.add('opacity-60')
		}
		if (statusEl) statusEl.textContent = 'Herberekenen…'
		setTimeout(() => {
			if (statusEl) statusEl.textContent = ''
		}, 2500)

		const response = await fetch('/ride/recalculate', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ suggestionIds })
		})

		if (!response.ok) {
			if (response.status === 429) {
				if (statusEl)
					statusEl.textContent =
						'Te veel verzoeken. Probeer het later.'
				return
			}
			throw new Error(`HTTP ${response.status}`)
		}

		const result = await response.json()
		displayRouteOnMap(result.route, result.markers, result.cached)
		if (statusEl)
			statusEl.textContent = result.cached
				? 'Opgehaald uit cache'
				: 'Route geüpdatet'
		console.log('Route recalculation result:', result)
	} catch (error) {
		console.error('Error recalculating route:', error)
		const statusEl2 = ensureRouteStatusElement()
		if (statusEl2) statusEl2.textContent = 'Fout bij herberekenen'
	} finally {
		setTimeout(() => {
			recalcInFlight = false
			if (recalculateButton) {
				recalculateButton.disabled = false
				recalculateButton.classList.remove('opacity-60')
			}
		}, 800)
	}
}

function displayRouteOnMap(route, markers, cached = false) {
	if (!mapContainer) return

	const normalizedMarkers = Array.isArray(markers) ? markers : []
	mapContainer.dataset.markers = JSON.stringify(normalizedMarkers)
	mapContainer.dataset.route = JSON.stringify(route)

	const mapInstance = mapContainer._appMapInstance || window.appMaps?.[0]
	if (!mapInstance) return

	mapInstance.setMarkers(normalizedMarkers, { center: true })
	mapInstance.setRoute(route, { center: true })

	// update a small status indicator if present
	const statusEl = document.getElementById('routeStatus')
	if (statusEl)
		statusEl.textContent = cached
			? 'Opgehaald uit cache'
			: 'Route geüpdatet'
}

async function updateSuggestions(day, hour) {
	if (!suggestionsContainer) return

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

		const suggestions = await response.json()
		renderSuggestions(suggestions)
	} catch (error) {
		if (error.name === 'AbortError') {
			return
		}

		suggestionsContainer.innerHTML =
			'<p class="text-sm theme-text-muted">Suggesties konden niet worden geladen.</p>'
	} finally {
		if (activeSuggestionRequest === controller) {
			activeSuggestionRequest = null
		}
		suggestionsContainer.removeAttribute('aria-busy')
	}
}

function renderSuggestions(suggestions = []) {
	if (!suggestionsContainer) return

	suggestionsContainer.innerHTML = ''

	if (!Array.isArray(suggestions) || suggestions.length === 0) {
		suggestionsContainer.innerHTML =
			'<p class="text-sm theme-text-muted">Er zijn momenteel geen suggesties beschikbaar.</p>'
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
}

window.addEventListener('DOMContentLoaded', () => {
	const initialChecked = radioGroup.querySelector('[ride-input]:checked')

	// snapshot initial route/markers so we can restore without network calls
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
	if (initialChecked) {
		const [day, hour] = initialChecked.id.split('_')
		updateSuggestions(day, hour)
	}
})
