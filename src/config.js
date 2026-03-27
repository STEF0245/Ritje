import 'dotenv/config'

const requiredEnvVars = [
	'FIREBASE_DATABASE_URL',

	'FIREBASE_WEB_API_KEY',
	'FIREBASE_WEB_AUTH_DOMAIN',
	'FIREBASE_WEB_PROJECT_ID',
	'FIREBASE_WEB_STORAGE_BUCKET',
	'FIREBASE_WEB_MESSAGING_SENDER_ID',
	'FIREBASE_WEB_APP_ID',
	'FIREBASE_WEB_MEASUREMENT_ID',

	'FIREBASE_ADMIN_TYPE',
	'FIREBASE_ADMIN_PROJECT_ID',
	'FIREBASE_ADMIN_PRIVATE_KEY_ID',
	'FIREBASE_ADMIN_PRIVATE_KEY',
	'FIREBASE_ADMIN_CLIENT_EMAIL',
	'FIREBASE_ADMIN_CLIENT_ID',
	'FIREBASE_ADMIN_AUTH_URI',
	'FIREBASE_ADMIN_TOKEN_URI',
	'FIREBASE_ADMIN_AUTH_PROVIDER_X509_CERT_URL',
	'FIREBASE_ADMIN_CLIENT_X509_CERT_URL',
	'FIREBASE_ADMIN_UNIVERSE_DOMAIN'
]

const optionalEnvVars = [
	'GEOAPIFY_API_KEY',
	'GEOAPIFY_USER_AGENT',
	'GEOAPIFY_RATE_LIMIT_WINDOW_MS',
	'GEOAPIFY_RATE_LIMIT_MAX'
]

function validateEnvVars() {
	const unsetRequiredEnvVars = requiredEnvVars.filter(
		(varName) => !process.env[varName]
	)
	const unsetOptionalEnvVars = optionalEnvVars.filter(
		(varName) => !process.env[varName]
	)

	if (unsetRequiredEnvVars.length > 0) {
		console.error(
			`Error: The following required environment variables are not set: ${unsetRequiredEnvVars.join(', ')}`
		)
		process.exit(1)
	}
	if (unsetOptionalEnvVars.length > 0) {
		console.warn(
			`Warning: The following optional environment variables are not set: ${unsetOptionalEnvVars.join(', ')}`
		)
	}
}

validateEnvVars()

const config = {
	port: process.env.PORT || 3000,
	nodeEnv: process.env.NODE_ENV || 'development',
	isProduction: process.env.NODE_ENV === 'production',

	firebase: {
		databaseURL: process.env.FIREBASE_DATABASE_URL,
		web: {
			apiKey: process.env.FIREBASE_WEB_API_KEY,
			authDomain: process.env.FIREBASE_WEB_AUTH_DOMAIN,
			projectId: process.env.FIREBASE_WEB_PROJECT_ID,
			appId: process.env.FIREBASE_WEB_APP_ID,
			storageBucket: process.env.FIREBASE_WEB_STORAGE_BUCKET,
			messagingSenderId: process.env.FIREBASE_WEB_MESSAGING_SENDER_ID,
			measurementId: process.env.FIREBASE_WEB_MEASUREMENT_ID
		},
		admin: {
			type: process.env.FIREBASE_ADMIN_TYPE,
			projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
			privateKeyId: process.env.FIREBASE_ADMIN_PRIVATE_KEY_ID,
			privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY,
			clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
			clientId: process.env.FIREBASE_ADMIN_CLIENT_ID,
			authUri: process.env.FIREBASE_ADMIN_AUTH_URI,
			tokenUri: process.env.FIREBASE_ADMIN_TOKEN_URI,
			authProviderX509CertUrl:
				process.env.FIREBASE_ADMIN_AUTH_PROVIDER_X509_CERT_URL,
			clientX509CertUrl: process.env.FIREBASE_ADMIN_CLIENT_X509_CERT_URL,
			universeDomain: process.env.FIREBASE_ADMIN_UNIVERSE_DOMAIN
		}
	},

	geoapify: {
		apiKey: process.env.GEOAPIFY_API_KEY,
		userAgent: process.env.GEOAPIFY_USER_AGENT,
		rateLimit: {
			windowMs:
				parseInt(process.env.GEOAPIFY_RATE_LIMIT_WINDOW_MS) || 5000,
			max: parseInt(process.env.GEOAPIFY_RATE_LIMIT_MAX) || 1
		}
	}
}

export default config
