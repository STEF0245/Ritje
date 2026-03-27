import { initializeApp, cert } from 'firebase-admin/app'

import config from '../config.js'

const app = initializeApp({
	credential: cert(config.firebase.admin),
	databaseURL: config.firebase.databaseURL
})

export default app
