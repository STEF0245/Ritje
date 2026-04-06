export const buildPageError = (status, message) => ({
	status,
	message
})

export const renderWithPageError = (
	res,
	{ status, view, title, message, extra = {} }
) => {
	return res.status(status).render(view, {
		title,
		pageError: buildPageError(status, message),
		...extra
	})
}
