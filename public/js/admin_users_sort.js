/**
 * @file Admin users list sorting behavior.
 * @brief Sorts the admin user collection by name or city on the client side.
 */

;(function initAdminUserSorting() {
	const userList = document.getElementById('userCollection')
	const sortSelect = document.getElementById('sortSelect')

	if (!userList || !sortSelect) {
		return
	}

	const getSortValue = (item, mode) => {
		if (mode === 'city' || mode === 'city_reverse') {
			return item.dataset.sortCity || ''
		}

		return item.dataset.sortName || ''
	}

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
