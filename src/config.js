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

requiredEnvVars.forEach((varName) => {
	if (!process.env[varName]) {
		console.error(
			`❌ Environment variable ${varName} is required but not set.`
		)
		process.exit(1)
	}
})

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
	}
}

export default config
