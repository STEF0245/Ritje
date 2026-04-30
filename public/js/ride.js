/**
 * @file Ride page interactions for selecting suggestions and updating route previews.
 * @brief  Keeps the ride page map in sync with selected suggestion checkboxes.
 */

document
	.querySelector('[input-radio-group]')
	.addEventListener('change', (e) => {
		if (e.target.matches('[ride-input]')) {
			const id = e.target.id
			const [day, hour] = id.split('_')
			console.log(`Selected schedule: ${day} at ${hour}`)
		}
	})

function updateMapPreview(scheduleId) {
	console.log(`Updating map preview for schedule: ${scheduleId}`)
	// Your map logic here
}
