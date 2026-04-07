const searchInput = document.getElementById('docsSearch')
const fileCards = Array.from(document.querySelectorAll('[data-doc-file-card]'))

const normalize = (value) => String(value || '').toLowerCase()

const applyFilter = (query) => {
	const normalizedQuery = normalize(query).trim()

	for (const card of fileCards) {
		const searchable = normalize(
			`${card.dataset.docPath || ''} ${card.textContent || ''}`
		)
		card.hidden =
			Boolean(normalizedQuery) && !searchable.includes(normalizedQuery)
	}
}

if (searchInput) {
	searchInput.addEventListener('input', (event) => {
		applyFilter(event.target.value)
	})
}
