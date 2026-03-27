import { getAuth } from 'firebase-admin/auth'
import app from './app.js'

const auth = getAuth(app)

export default auth
