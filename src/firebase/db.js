import { getDatabase } from 'firebase-admin/database'
import app from './app.js'

const db = getDatabase(app)

export default db
