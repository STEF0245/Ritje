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

	createMap(latitude, longitude) {
		this.mapInstance = L.map('map', {
			minZoom: 9,
			maxZoom: 18,
			center: [latitude, longitude],
			zoom: 16,
			maxBounds: [
				[49.5, 2.5], // Southwest coordinates of Belgium
				[51.5, 6.4] // Northeast coordinates of Belgium
			],
			attributionControl: false,
			dragging: true,
			touchZoom: true
		})

		this.addTileLayer()
		this.addMarker(latitude, longitude)
		this.addAttribution()
	},

	addTileLayer() {
		L.tileLayer(
			'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.{ext}',
			{
				ext: 'png',
				minNativeZoom: 0,
				maxNativeZoom: 20
			}
		).addTo(this.mapInstance)
	},

	addMarker(latitude, longitude, title) {
		const marker = L.marker([latitude, longitude], {
			title: title || 'Uw woonplaats',
			alt: 'Marker die uw woonplaats aangeeft op de kaart'
		}).addTo(this.mapInstance)

		// Create custom styled popup
		const popupContent = L.popup([latitude, longitude], {
			closeButton: false,
			autoClose: false,
			closeOnClick: true,
			className: 'map-popup theme-surface theme-border',
			content: title || 'Uw woonplaats'
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
