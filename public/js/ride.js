/**
 * @file Ride page interactions for selecting suggestions and recalculating the map route.
 * @brief  Handles multi-select suggestions and live route preview updates.
 */

const parseJsonDataset = (value, fallback = null) => {
	if (!value) return fallback
	try {
		return JSON.parse(value)
	} catch {
		return fallback
	}
}

const buildStatusMessage = (count) => {
	if (count === 1) return 'Route bijgewerkt voor 1 geselecteerde persoon.'
	return `Route bijgewerkt voor ${count} geselecteerde personen.`
}

document.addEventListener('DOMContentLoaded', () => {
	const rideRoot = document.querySelector('[data-ride-page]')
	if (!rideRoot) return

	const mapElement = rideRoot.querySelector('[data-map]')
	const routeForm = rideRoot.querySelector('[data-route-form]')
	if (!mapElement || !routeForm) return

	const mapInstance = mapElement._appMapInstance
	if (!mapInstance) return

	const recalculateButton = routeForm.querySelector(
		'[data-recalculate-route]'
	)
	const resetButton = routeForm.querySelector('[data-reset-route]')
	const statusElement = routeForm.querySelector('[data-route-status]')
	const suggestionCheckboxes = Array.from(
		routeForm
			.closest('[data-ride-page]')
			.querySelectorAll('[data-suggestion-checkbox]')
	)

	const routePreviewEndpoint =
		mapElement.dataset.routePreviewEndpoint || '/ride/route-preview'
	const initialMarkers = parseJsonDataset(mapElement.dataset.markers, [])
	const initialRoute = parseJsonDataset(mapElement.dataset.route, null)

	const setBusyState = (isBusy) => {
		if (recalculateButton) recalculateButton.disabled = isBusy
		if (resetButton) resetButton.disabled = isBusy
		for (const checkbox of suggestionCheckboxes) {
			checkbox.disabled = isBusy
		}
	}

	const renderInitialState = () => {
		mapInstance.setMarkers(initialMarkers, { center: false })
		mapInstance.setRoute(initialRoute, { center: true })
		if (statusElement) {
			statusElement.textContent =
				'Kies minstens 1 suggestie en klik op herberekenen.'
		}
	}

	const getSelectedUids = () => {
		return suggestionCheckboxes
			.filter((checkbox) => checkbox.checked)
			.map((checkbox) => checkbox.value)
			.filter(Boolean)
	}

	const recalculateRoute = async () => {
		const selectedUids = getSelectedUids()
		if (selectedUids.length === 0) {
			renderInitialState()
			return
		}

		setBusyState(true)
		if (statusElement) {
			statusElement.textContent = 'Route wordt herberekend...'
		}

		try {
			const response = await fetch(routePreviewEndpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ selectedUids })
			})

			const payload = await response.json()
			if (!response.ok) {
				throw new Error(payload?.error || 'Herberekenen mislukt.')
			}

			const previewMarkers = Array.isArray(payload?.markers)
				? payload.markers
				: initialMarkers
			mapInstance.setMarkers(previewMarkers, { center: false })
			mapInstance.setRoute(payload?.route || initialRoute, {
				center: true
			})

			if (statusElement) {
				statusElement.textContent = buildStatusMessage(
					selectedUids.length
				)
			}
		} catch (error) {
			if (statusElement) {
				statusElement.textContent =
					error?.message ||
					'Kon de route niet herberekenen. Probeer opnieuw.'
			}
		} finally {
			setBusyState(false)
		}
	}

	recalculateButton?.addEventListener('click', recalculateRoute)
	resetButton?.addEventListener('click', () => {
		for (const checkbox of suggestionCheckboxes) {
			checkbox.checked = false
		}
		renderInitialState()
	})
})
