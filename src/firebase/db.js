/**
 * @file Firebase Realtime Database bootstrap.
 * @brief Exposes the shared database reference used throughout the app.
 */

import { getDatabase } from 'firebase-admin/database'
import app from './app.js'

const db = getDatabase(app)

export default db
