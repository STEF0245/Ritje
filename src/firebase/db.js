import { getDatabase } from 'firebase-admin/database'
import app from './app.js'

const db = getDatabase(app)

export const getUserRef = (uid) => {
	return db.ref(`users/${uid}`)
}

export default db
