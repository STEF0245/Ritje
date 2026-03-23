const scheduleRows = document.querySelectorAll('[data-schedule-row]')

const updateRowBoundOptions = (row, changedBound = null) => {
	const startSelect = row.querySelector('[data-schedule-bound="start"]')
	const endSelect = row.querySelector('[data-schedule-bound="end"]')

	if (!startSelect || !endSelect) {
		return
	}

	const startValue = startSelect.value
	const endValue = endSelect.value

	if (
		changedBound === 'start' &&
		startValue &&
		endValue &&
		endValue <= startValue
	) {
		endSelect.value = ''
	}

	if (
		changedBound === 'end' &&
		startValue &&
		endValue &&
		startValue >= endValue
	) {
		startSelect.value = ''
	}

	const nextStartValue = startSelect.value
	const nextEndValue = endSelect.value
	const startBoundaryOptions = Array.from(startSelect.options).filter(
		(option) => option.value
	)
	const endBoundaryOptions = Array.from(endSelect.options).filter(
		(option) => option.value
	)
	const firstBoundaryValue = endBoundaryOptions[0]?.value || ''
	const lastBoundaryValue =
		startBoundaryOptions[startBoundaryOptions.length - 1]?.value || ''

	for (const option of startSelect.options) {
		if (!option.value) {
			option.hidden = false
			option.disabled = false
			continue
		}

		const isAllowed = nextEndValue
			? option.value < nextEndValue
			: option.value !== lastBoundaryValue
		option.hidden = !isAllowed
		option.disabled = !isAllowed
	}

	for (const option of endSelect.options) {
		if (!option.value) {
			option.hidden = false
			option.disabled = false
			continue
		}

		const isAllowed = nextStartValue
			? option.value > nextStartValue
			: option.value !== firstBoundaryValue
		option.hidden = !isAllowed
		option.disabled = !isAllowed
	}
}

for (const row of scheduleRows) {
	const startSelect = row.querySelector('[data-schedule-bound="start"]')
	const endSelect = row.querySelector('[data-schedule-bound="end"]')

	if (!startSelect || !endSelect) {
		continue
	}

	startSelect.addEventListener('change', () =>
		updateRowBoundOptions(row, 'start')
	)
	endSelect.addEventListener('change', () =>
		updateRowBoundOptions(row, 'end')
	)
	updateRowBoundOptions(row)
}
