/**
 * @file Ride page interactions for selecting suggestions and updating route previews.
 * @brief  Keeps the ride page map in sync with selected suggestion checkboxes.
 */

const radioGroup = document.querySelector('[input-radio-group]')
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
	const params = new URLSearchParams({ day, hour })

	const response = await fetch(`/ride/suggestions?${params.toString()}`)
	const suggestions = await response.json()
	renderSuggestions(suggestions)
}

function renderSuggestions(suggestions = []) {
	const container = document.querySelector(
		'.ride-suggestion-panel .mt-6.flex-1'
	)
	if (!container) return

	if (!Array.isArray(suggestions) || suggestions.length === 0) {
		container.innerHTML =
			'<p class="text-sm theme-text-muted">Er zijn momenteel geen suggesties beschikbaar.</p>'
		return
	}

	const itemsHtml = suggestions
		.map((ride, index) => {
			const title = ride.title || `Onbekende persoon`
			const addr = (ride.lines && ride.lines[1]) || 'Onbekend adres'
			const detourDistance =
				ride?.detour?.distance ?? ride?.detourDistanceKm
			const detourDuration =
				ride?.detour?.duration ?? ride?.detourDurationMinutes
			const distance = Number.isFinite(Number(detourDistance))
				? `+${Math.round(Number(detourDistance) * 10) / 10} km`
				: null
			const duration = Number.isFinite(Number(detourDuration))
				? `+${Math.round(Number(detourDuration))} min`
				: null

			const metricsHtml =
				distance || duration
					? `<div class="mt-2 flex flex-wrap gap-2">${distance ? `<span class="theme-pill border theme-border px-2 py-1 text-xs theme-text-muted">${distance}</span>` : ''}${duration ? `<span class="theme-pill border theme-border px-2 py-1 text-xs theme-text-muted">${duration}</span>` : ''}</div>`
					: ''

			return `
				<label class="theme-pill p-4 border theme-border theme-surface ride-suggestion-item cursor-pointer block">
					<input type="checkbox" class="ride-suggestion-check hidden" data-suggestion-checkbox value="${ride.uid || ''}" aria-label="Selecteer ${title}" />
					<span class="min-w-0 flex-1">
						<h4 class="text-base font-semibold theme-text-primary leading-tight">${title}</h4>
						<p class="text-sm theme-text-muted">${addr}</p>
						${metricsHtml}
					</span>
				</label>
			`
		})
		.join('\n')

	container.innerHTML = `<ul class="space-y-3">${itemsHtml}</ul>`
}

window.addEventListener('load', () => {
	const checkedInput = document.querySelector('[ride-input]:checked')
	if (checkedInput) {
		const id = checkedInput.id
		const [day, hour] = id.split('_')
		updateSuggestions(day, hour)
	}
})
