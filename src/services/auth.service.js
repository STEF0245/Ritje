const auth = {
	login: async (email, password) => {
		// Simulate login logic (replace with actual Firebase auth logic)
		if (email === '' || password === '') {
			throw new Error('Email and password are required')
		}
		// Simulate token generation
		return 'fake-jwt-token'
	}
}

export default auth
