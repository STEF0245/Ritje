import 'dotenv/config'

const requiredEnvVars = [
	'SUPABASE_URL',
	'SUPABASE_PUBLISHABLE_KEY',
	'SUPABASE_SECRET_KEY',
	'SUPABASE_DATABASE_URL'
]

// Validate required environment variables
requiredEnvVars.forEach((varName) => {
	if (!process.env[varName]) {
		throw new Error(
			`Missing required environment variable: ${varName}. Please check your .env file.`
		)
	}
})

export const config = {
	nodeEnv: process.env.NODE_ENV || 'development',
	isProduction: process.env.NODE_ENV === 'production',

	supabase: {
		url: process.env.SUPABASE_URL,
		publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY,
		secretKey: process.env.SUPABASE_SECRET_KEY,
		databaseUrl: process.env.SUPABASE_DATABASE_URL
	},

	port: process.env.PORT || 3000
}
