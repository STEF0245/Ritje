/**
 * @file Firebase Realtime Database bootstrap.
 * @brief  Exposes the shared database reference used throughout the app.
 * @details  Binds the Realtime Database client to the initialized Firebase Admin app.
 */

import { getDatabase } from 'firebase-admin/database'
import app from './app.js'

const db = getDatabase(app)

export default db
