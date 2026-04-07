/**
 * @file Firebase identifier validation helpers.
 * @brief Validates UID shapes used by the app's admin and profile flows.
 * @details Contains shared regex-based validation utilities for Firebase-style user identifiers.
 */

export const FIREBASE_UID_PATTERN = /^[A-Za-z0-9_-]{8,28}$/

/**
 * @brief Validate a Firebase UID against the app's expected pattern.
 * @details Ensures route and form UIDs match the allowed character set and length constraints before database/auth operations.
 * @param {unknown} uid - UID candidate value.
 * @returns {boolean} True when the UID is a valid string matching the pattern.
 */
export const isValidFirebaseUid = (uid) => {
	return typeof uid === 'string' && FIREBASE_UID_PATTERN.test(uid)
}
