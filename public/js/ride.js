/**
 * @file Ride page interactions for selecting suggestions and updating route previews.
 * @brief  Keeps the ride page map in sync with selected suggestion checkboxes.
 */

const scheduleRadios = document.querySelectorAll('[ride-input]')

const getSelectedSchedule = () => {
	for (const radio of scheduleRadios) {
		if (radio.checked) {
			return radio.id
		}
	}
	return null
}

scheduleRadios.forEach((radio) => {
	radio.addEventListener('change', () => {
		const selectedSchedule = getSelectedSchedule()
		if (selectedSchedule) {
			// Update the map preview based on the selected schedule
			updateMapPreview(selectedSchedule)
		}
	})
})

function updateMapPreview(scheduleId) {
	// This function should contain the logic to update the map preview
	// based on the selected schedule. This is a placeholder implementation.
	console.log(`Updating map preview for schedule: ${scheduleId}`)
	// Example: You might want to fetch new route data and update the map accordingly.
}
