import { randomBytes } from 'crypto'

export const generateShortUid = () => {
	const chars =
		'abcdefghijklmnopqrstuvwxyz0123456789'
	const bytes = randomBytes(8)
	let result = ''
	for (let i = 0; i < 8; i++) {
		result += chars.charAt(bytes[i] % chars.length)
	}
	return result
}
