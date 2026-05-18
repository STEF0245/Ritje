/**
 * @file Documentation search UI for admin documentation viewer.
 * @brief Filters repository documentation cards by search query.
 * @details Provides real-time search functionality that filters documentation cards by file path and content. Updates card visibility as the user types into the search input.
 */

const searchInput = document.getElementById('docsSearch')
const fileCards = Array.from(document.querySelectorAll('[data-doc-file-card]'))

/**
 * @brief  Normalize text for case-insensitive filtering.
 * @param {unknown} value - Raw value to normalize.
 * @returns {string} Lowercased string.
 */
const normalize = (value) => String(value || '').toLowerCase()

/**
 * @brief  Filter documentation cards by the active search query.
 * @details  Hides cards whose file path and content do not contain the normalized query string.
 * @param {string} query - Search text entered by the user.
 * @returns {void}
 */
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
