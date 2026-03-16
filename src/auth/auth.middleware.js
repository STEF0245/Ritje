export const optionalAuth = async (req, res, next) => {
	try {
		const accessToken = req.cookies['sb-access-token']

		if (accessToken) {
			const {
				data: { user }
			} = await supabase.auth.getUser(accessToken)
			req.user = user || null
		} else {
			req.user = null
		}

		next()
	} catch (error) {
		req.user = null
		next()
	}
}
