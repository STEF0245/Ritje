/**
 * @file Input normalization and validation helpers.
 * @brief Sanitizes text, validates lengths, and checks common formats.
 */

export const safeTrim = (value, maxLength = 255) => {
	return `${value ?? ''}`.trim().slice(0, maxLength)
}

export const sanitizeText = (value, maxLength = 255) => {
	return `${value ?? ''}`
		.normalize('NFKC')
		.replace(/[\u0000-\u001F\u007F]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, maxLength)
}

export const validateLength = (value, label, minLength, maxLength) => {
	if (value.length < minLength || value.length > maxLength) {
		throw new Error(`${label} has an invalid length`)
	}
}

export const isValidHttpsUrl = (value) => {
	if (!value) return true
	try {
		const parsed = new URL(value)
		return parsed.protocol === 'https:'
	} catch {
		return false
	}
}

export const isValidEmail = (value) => {
	if (!value) return false
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}
