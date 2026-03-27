import 'dotenv/config'

const requiredEnvVars = [
	'FIREBASE_WEB_API_KEY',
	'FIREBASE_WEB_AUTH_DOMAIN',
	'FIREBASE_WEB_PROJECT_ID',
	'FIREBASE_WEB_APP_ID'
]

// Validate required environment variables
requiredEnvVars.forEach((varName) => {
	if (!process.env[varName]) {
		console.log(
			`❌ Environment variable ${varName} is required but not set.`
		)
		process.exit(1)
	}
})

export const config = {
	nodeEnv: process.env.NODE_ENV || 'development',
	isProduction: process.env.NODE_ENV === 'production',

	firebase: {
		web: {
			apiKey: process.env.FIREBASE_WEB_API_KEY,
			authDomain: process.env.FIREBASE_WEB_AUTH_DOMAIN,
			projectId: process.env.FIREBASE_WEB_PROJECT_ID,
			appId: process.env.FIREBASE_WEB_APP_ID,
			storageBucket: process.env.FIREBASE_WEB_STORAGE_BUCKET,
			messagingSenderId: process.env.FIREBASE_WEB_MESSAGING_SENDER_ID,
			measurementId: process.env.FIREBASE_WEB_MEASUREMENT_ID
		}
	},

	port: process.env.PORT || 3000
}
