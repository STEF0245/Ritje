/**
 * Leaflet Map Handler
 * Initializes and manages the Leaflet map display with theme-styled popup
 */

const LeafletMap = {
	mapInstance: null,
	mapElement: null,

	init() {
		this.mapElement = document.getElementById('map')
		if (!this.mapElement) return
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
			minZoom: 8,
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
		this.addAttribution()
	},

	addTileLayer() {
		L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(
			this.mapInstance
		)
	},

	addMarker(latitude, longitude, details) {
		if (!this.mapInstance) return
		const marker = L.marker([latitude, longitude], {
			title: details.title,
			icon: L.divIcon({
				className: 'custom-div-icon',
				html: `
					<i class="fas fa-house text-[1.25rem] theme-accent-text"></i>
				`,
				iconSize: [24, 24],
				iconAnchor: [12, 12],
				popupAnchor: [0, -6]
			})
		}).addTo(this.mapInstance)
		const popupContent = `<div class="theme-popup">
            <h3 class="theme-popup-title">${details.title}</h3>
            <p class="theme-popup-text">${details.addressLineOne}</p>
            <p class="theme-popup-text">${details.addressLineTwo}</p>
            ${details.mapsUrl ? `<a href="${details.mapsUrl}" target="_blank" rel="noopener" class="theme-popup-link">Google Maps</a>` : ''}
        </div>`
		marker.bindPopup(popupContent, { closeButton: true })
	},

	addAttribution() {
		if (!this.mapInstance) return
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
		if (!this.mapElement) return
		this.mapElement.classList.add(
			'flex',
			'items-center',
			'justify-center',
			'text-sm',
			'theme-surface',
			'theme-border',
			'theme-text-muted'
		)
		this.mapElement.textContent =
			'Geen geldige coördinaten beschikbaar om de kaart te tonen.'
	}
}

document.addEventListener('DOMContentLoaded', () => {
	LeafletMap.init()
})
