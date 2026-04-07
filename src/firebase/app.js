/**
 * @file Firebase Admin app bootstrap.
 * @brief  Initializes the shared Firebase Admin application instance.
 * @details  Creates a singleton Firebase Admin app using service account credentials from runtime configuration.
 */

import { initializeApp, cert } from 'firebase-admin/app'

import config from '../config.js'

const app = initializeApp({
	credential: cert(config.firebase.admin),
	databaseURL: config.firebase.databaseURL
})

export default app
