/**
 * @file Ride page interactions for selecting suggestions and updating route previews.
 * @brief  Keeps the ride page map in sync with selected suggestion checkboxes.
 */

const radioGroup = document.querySelector('[input-radio-group]')
const suggestionsContainer = document.querySelector('[data-ride-suggestions]')
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
	if (initialChecked) {
		const [day, hour] = initialChecked.id.split('_')
		updateSuggestions(day, hour)
	}
})
