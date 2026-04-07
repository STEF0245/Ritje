class AppMap {
	static MAP_BOUNDS_BELGIUM = [
		[51.5051, 6.4081],
		[49.497, 2.5407]
	]

	constructor(element) {
		this.element = element
		this.instance = null
	}

	init() {
		if (!this.element) return this

		const latitude = parseFloat(this.element.dataset.latitude || '')
		const longitude = parseFloat(this.element.dataset.longitude || '')
		if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
			this.showNoCoordinatesMessage()
			return this
		}

		this.instance = this.createMap(latitude, longitude)
		this.addTileLayer()
		this.addAttribution()

		return this
	}

	createMap(latitude, longitude) {
		return L.map(this.element, {
			minZoom: 8,
			maxZoom: 18,
			center: [latitude, longitude],
			zoom: 16,
			maxBounds: AppMap.MAP_BOUNDS_BELGIUM,
			attributionControl: false,
			dragging: true,
			touchZoom: true
		})
	}

	addTileLayer() {
		if (!this.instance) return
		L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(
			this.instance
		)
	}

	createMarkerIcon() {
		return L.divIcon({
			className: 'custom-div-icon',
			html: '<i class="fas fa-house text-[1.25rem] theme-accent-text"></i>',
			iconSize: [24, 24],
			iconAnchor: [12, 12],
			popupAnchor: [0, -6]
		})
	}

	buildPopupCard(details) {
		const card = document.createElement('div')
		card.className =
			'theme-surface theme-border theme-pill px-3 py-2 mb-3 text-sm theme-text-primary'

		const title = document.createElement('p')
		title.className = 'm-0! mb-1! font-semibold leading-tight'
		title.textContent = details.title
		card.appendChild(title)

		for (const line of details.lines.filter(Boolean)) {
			const lineElement = document.createElement('p')
			lineElement.className =
				'm-0! text-xs theme-text-muted! leading-tight'
			lineElement.textContent = line
			card.appendChild(lineElement)
		}

		if (details.mapsUrl) {
			const mapsLinkWrapper = document.createElement('p')
			mapsLinkWrapper.className =
				'm-0! mt-1! text-[0.65rem] theme-text-muted! leading-tight hover:underline'

			const mapsLink = document.createElement('a')
			mapsLink.className = 'theme-text-muted!'
			mapsLink.href = details.mapsUrl
			mapsLink.target = '_blank'
			mapsLink.rel = 'noopener noreferrer'
			mapsLink.textContent = 'Google Maps'

			mapsLinkWrapper.appendChild(mapsLink)
			card.appendChild(mapsLinkWrapper)
		}

		return card
	}

	addMarker(latitude, longitude, details) {
		if (!this.instance) {
			return
		}

		const marker = L.marker([latitude, longitude], {
			title: details.title,
			icon: this.createMarkerIcon()
		}).addTo(this.instance)

		const popup = L.popup([latitude, longitude], {
			closeButton: false,
			autoClose: false,
			closeOnClick: true,
			className: 'map-popup',
			content: this.buildPopupCard(details)
		})

		marker.bindPopup(popup)
		marker.openPopup()
	}

	addAttribution() {
		if (!this.instance) return

		const attribution = L.control.attribution({
			position: 'bottomright',
			prefix: false
		})

		attribution.addTo(this.instance)
		attribution.addAttribution(
			'&copy; <a href="https://www.stadiamaps.com/" target="_blank" rel="noopener">Stadia Maps</a>'
		)
		attribution.addAttribution(
			'&copy; <a href="https://openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a>'
		)
		attribution.addAttribution(
			'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
		)
	}

	showNoCoordinatesMessage() {
		this.element.classList.add(
			'flex',
			'items-center',
			'justify-center',
			'text-sm',
			'theme-surface',
			'theme-border',
			'theme-text-muted'
		)
		this.element.textContent =
			'Geen geldige coördinaten beschikbaar om de kaart te tonen.'
	}
}

window.AppMap = AppMap
