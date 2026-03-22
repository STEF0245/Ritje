/**
 * Profile Map Handler
 * Initializes and manages the Leaflet map display with theme-styled popup
 */

const ProfileMap = {
	mapInstance: null,
	mapElement: null,

	init() {
		this.mapElement = document.getElementById('map')
		if (!this.mapElement) {
			return
		}

		const latitude = parseFloat(this.mapElement.dataset.latitude || '')
		const longitude = parseFloat(this.mapElement.dataset.longitude || '')

		if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
			this.createMap(latitude, longitude)
		} else {
			this.showNoCoordinatesMessage()
		}
	},

	getProfileLocationDetails(latitude, longitude) {
		const fullName = this.mapElement?.dataset?.fullName || 'Uw woonplaats'
		const addressLineOne = this.mapElement?.dataset?.addressLineOne || ''
		const addressLineTwo = this.mapElement?.dataset?.addressLineTwo || ''
		const mapsUrl = this.mapElement?.dataset?.mapsUrl || ''

		return {
			fullName,
			addressLineOne,
			addressLineTwo,
			mapsUrl,
			latitude,
			longitude
		}
	},

	createMap(latitude, longitude) {
		this.mapInstance = L.map('map', {
			minZoom: 9,
			maxZoom: 18,
			center: [latitude, longitude],
			zoom: 16,
			maxBounds: [
				[51.5051, 6.4081], // Northeast coordinates of Belgium
				[49.497, 2.5407] // Southwest coordinates of Belgium
			],
			attributionControl: false,
			dragging: true,
			touchZoom: true
		})

		this.addTileLayer()
		const locationDetails = this.getProfileLocationDetails(
			latitude,
			longitude
		)
		this.addMarker(latitude, longitude, locationDetails)
		this.addAttribution()
	},

	addTileLayer() {
		L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
			minNativeZoom: 0,
			maxNativeZoom: 20
		}).addTo(this.mapInstance)
	},

	addMarker(latitude, longitude, locationDetails) {
		const label = locationDetails?.fullName || 'Uw woonplaats'
		const marker = L.marker([latitude, longitude], {
			title: label
		}).addTo(this.mapInstance)

		const popupCard = document.createElement('div')
		popupCard.className =
			'theme-surface theme-border theme-pill px-3 py-2 mb-3 text-sm theme-text-primary'

		const titleElement = document.createElement('p')
		titleElement.className = 'm-0! mb-1! font-semibold leading-tight'
		titleElement.textContent = label
		popupCard.appendChild(titleElement)

		const details = [
			locationDetails?.addressLineOne,
			locationDetails?.addressLineTwo
		].filter(Boolean)

		details.forEach((line) => {
			const lineElement = document.createElement('p')
			lineElement.className =
				'm-0! text-xs theme-text-muted! leading-tight'
			lineElement.textContent = line
			popupCard.appendChild(lineElement)
		})

		if (locationDetails?.mapsUrl) {
			const linkElement = document.createElement('p')
			linkElement.className =
				'm-0! text-xs theme-text-muted! leading-tight hover:underline'

			const linkAnchor = document.createElement('a')
			linkAnchor.className = 'theme-text-muted!'
			linkAnchor.href = locationDetails.mapsUrl
			linkAnchor.target = '_blank'
			linkAnchor.rel = 'noopener noreferrer'
			linkAnchor.textContent = 'Bekijk op kaart'
			linkElement.appendChild(linkAnchor)
			popupCard.appendChild(linkElement)
		}

		const popupContent = L.popup([latitude, longitude], {
			closeButton: false,
			autoClose: false,
			closeOnClick: true,
			className: 'map-popup',
			content: popupCard
		})
		marker.bindPopup(popupContent)
		marker.openPopup()
	},

	addAttribution() {
		if (!this.mapInstance) {
			return
		}

		const attribution = L.control.attribution({
			position: 'bottomright',
			prefix: false
		})

		attribution.addTo(this.mapInstance)
		attribution.addAttribution(
			'&copy; <a href="https://www.stadiamaps.com/" target="_blank" rel="noopener">Stadia Maps</a>'
		)
		attribution.addAttribution(
			'&copy; <a href="https://openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a>'
		)
		attribution.addAttribution(
			'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
		)
	},

	showNoCoordinatesMessage() {
		if (!this.mapElement) {
			return
		}

		this.mapElement.classList.add(
			'flex',
			'items-center',
			'justify-center',
			'text-sm'
		)
		this.mapElement.classList.add(
			'theme-surface',
			'theme-border',
			'theme-text-muted'
		)
		this.mapElement.textContent =
			'Geen geldige coördinaten beschikbaar om de kaart te tonen.'
	}
}

// Initialize map when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
	ProfileMap.init()
})
