/**
 * @file Admin users list sorting behavior.
 * @brief  Sorts the admin user collection by name or city on the client side.
 * @details  This script adds an event listener to the sort select dropdown and sorts the user list accordingly when the selection changes. It uses localeCompare for proper alphabetical sorting based on the Dutch locale.
 */

;(function initAdminUserSorting() {
	const userList = document.getElementById('userCollection')
	const sortSelect = document.getElementById('sortSelect')
	const searchInput = document.getElementById('usersSearch')

	if (!userList || !sortSelect) {
		return
	}

	const userItems = Array.from(userList.querySelectorAll('[data-user-item]'))

	/**
	 * @brief  Normalize text for filtering user rows.
	 * @param {unknown} value - Raw value to normalize.
	 * @returns {string} Lowercased string.
	 */
	const normalize = (value) => String(value || '').toLowerCase()

	/**
	 * @brief  Resolve the sortable value for a user row.
	 * @details  Selects either city or name based on the active sort mode and falls back to an empty string.
	 * @param {HTMLElement} item - User list item element.
	 * @param {string} mode - Sort mode identifier.
	 * @returns {string} Comparable value for sorting.
	 */
	const getSortValue = (item, mode) => {
		if (mode === 'city' || mode === 'city_reverse') {
			return item.dataset.sortCity || ''
		}

		return item.dataset.sortName || ''
	}

	/**
	 * @brief  Sort all user rows by the selected criteria.
	 * @details  Reorders DOM nodes in-place using locale-aware comparison and optional reverse order.
	 * @param {string} criteria - Selected sort mode.
	 * @returns {void}
	 */
	const sortUsers = (criteria) => {
		const users = Array.from(userList.querySelectorAll('[data-user-item]'))
		const isReverse = criteria.endsWith('_reverse')

		users.sort((firstItem, secondItem) => {
			const firstValue = getSortValue(firstItem, criteria)
			const secondValue = getSortValue(secondItem, criteria)
			const compareResult = firstValue.localeCompare(secondValue, 'nl-BE')
			return isReverse ? -compareResult : compareResult
		})

		userList.replaceChildren(...users)
	}

	/**
	 * @brief  Filter the visible user rows by search query.
	 * @details  Matches against the rendered row text using a case-insensitive comparison.
	 * @param {string} query - Search text entered by the user.
	 * @returns {void}
	 */
	const applyFilter = (query) => {
		const normalizedQuery = normalize(query).trim()

		for (const item of userItems) {
			const searchable = normalize(item.textContent || '')
			item.hidden =
				Boolean(normalizedQuery) && !searchable.includes(normalizedQuery)
		}
	}

	sortSelect.addEventListener('change', (event) => {
		sortUsers(event.target.value)
	})

	if (searchInput) {
		searchInput.addEventListener('input', (event) => {
			applyFilter(event.target.value)
		})
	}

	sortUsers(sortSelect.value)
	applyFilter(searchInput?.value || '')
})()
