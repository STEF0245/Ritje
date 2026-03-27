import { initializeApp, cert } from 'firebase-admin/app'

import serviceAccount from '../kunnenwesamenrijden-firebase-adminsdk-fbsvc-f81b50d37a.json' with { type: 'json' }
const app = initializeApp({
	credential: cert(serviceAccount),
	databaseURL:
		'https://kunnenwesamenrijden-default-rtdb.europe-west1.firebasedatabase.app/'
})

export default app
