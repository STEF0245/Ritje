export const FIREBASE_UID_PATTERN = /^[A-Za-z0-9_-]{8,28}$/

export const isValidFirebaseUid = (uid) => {
	return typeof uid === 'string' && FIREBASE_UID_PATTERN.test(uid)
}
