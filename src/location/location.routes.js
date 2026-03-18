import express from 'express'
import { Window } from 'happy-dom'

const router = express.Router()

const NOMINATIM_USER_AGENT =
	process.env.GEOCODER_USER_AGENT ||
	'Ritje/1.0 (reverse geocoding endpoint; contact: admin@example.com)'

let geocoderPromise

const defineGlobal = (name, value) => {
	Object.defineProperty(globalThis, name, {
		value,
		writable: true,
		configurable: true
	})
}

const getNominatimGeocoder = async () => {
	if (!geocoderPromise) {
		geocoderPromise = (async () => {
			const window = new Window()

			defineGlobal('window', window)
			defineGlobal('document', window.document)
			if (!globalThis.navigator) {
				defineGlobal('navigator', window.navigator)
			}
			if (!globalThis.screen) {
				defineGlobal('screen', window.screen)
			}
			defineGlobal('HTMLElement', window.HTMLElement)
			defineGlobal('SVGElement', window.SVGElement)
			defineGlobal('XMLHttpRequest', window.XMLHttpRequest)

			const nativeFetch = globalThis.fetch.bind(globalThis)
			globalThis.fetch = (input, init = {}) => {
				const headers = new Headers(init.headers || {})
				if (!headers.has('User-Agent')) {
					headers.set('User-Agent', NOMINATIM_USER_AGENT)
				}
				if (!headers.has('Accept')) {
					headers.set('Accept', 'application/json')
				}

				return nativeFetch(input, { ...init, headers })
			}

			const geocoderModule = await import('leaflet-control-geocoder')
			return geocoderModule.geocoders.nominatim({
				serviceUrl: 'https://nominatim.openstreetmap.org/'
			})
		})()
	}

	return geocoderPromise
}

const parseCoordinate = (value, label, min, max) => {
	const parsed = Number(value)

	if (!Number.isFinite(parsed)) {
		throw new Error(`${label} must be a valid number`)
	}

	if (parsed < min || parsed > max) {
		throw new Error(`${label} must be between ${min} and ${max}`)
	}

	return parsed
}

router.post('/reverse-geocode', async (req, res) => {
	try {
		const lat = parseCoordinate(req.body?.lat, 'lat', -90, 90)
		const lon = parseCoordinate(req.body?.lon, 'lon', -180, 180)
		const geocoder = await getNominatimGeocoder()
		const matches = await geocoder.reverse({ lat, lng: lon }, 4096)
		const match = matches?.[0]
		const properties = match?.properties || {}
		const address = properties.address || {}

		if (!match) {
			return res.status(404).json({
				error: 'No address found for provided coordinates'
			})
		}

		return res.status(200).json({
			lat,
			lon,
			displayName: match.name || null,
			address: {
				street: address.road || null,
				houseNumber: address.house_number || null,
				postalCode: address.postcode || null,
				city: address.city || address.town || address.village || null,
				country: address.country || null
			},
			raw: properties
		})
	} catch (error) {
		const isValidationError =
			typeof error?.message === 'string' &&
			error.message.includes('must be')

		return res.status(isValidationError ? 400 : 502).json({
			error:
				error?.message ||
				'Reverse geocoding failed via leaflet-control-geocoder'
		})
	}
})

export default router
