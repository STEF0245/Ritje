/**
 * @file Admin users list sorting behavior.
 * @brief  Summary: Sorts the admin user collection by name or city on the client side.
 * @details  Details: This script adds an event listener to the sort select dropdown and sorts the user list accordingly when the selection changes. It uses localeCompare for proper alphabetical sorting based on the Dutch locale.
 */

;(function initAdminUserSorting() {
	const userList = document.getElementById('userCollection')
	const sortSelect = document.getElementById('sortSelect')

	if (!userList || !sortSelect) {
		return
	}

	/**
	 * @brief  Summary: Resolve the sortable value for a user row.
	 * @details  Details: Selects either city or name based on the active sort mode and falls back to an empty string.
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
	 * @brief  Summary: Sort all user rows by the selected criteria.
	 * @details  Details: Reorders DOM nodes in-place using locale-aware comparison and optional reverse order.
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

	sortSelect.addEventListener('change', (event) => {
		sortUsers(event.target.value)
	})

	sortUsers(sortSelect.value)
})()
