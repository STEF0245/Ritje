/**
 * @file Leaflet map bootstrap for profile and admin location views.
 * @brief  Renders map markers and popup content from server-provided data.
 * @details  This script defines the AppMap class which initializes Leaflet maps on elements with the `data-map` attribute. It derives the initial center from dataset markers, optional school marker coordinates, or a Belgian fallback center. It then creates a map instance, adds tile layers, and renders markers with custom icons and popups. The map is constrained to Belgian boundaries and includes proper attribution.
 */

class AppMap {
	static MAP_BOUNDS_BELGIUM = [
		[51.5051, 6.4081],
		[49.497, 2.5407]
	]

	static DEFAULT_CENTER_BELGIUM = {
		latitude: 50.8503,
		longitude: 4.3517
	}

	static DEFAULT_SELECTOR = '[data-map]'

	/**
	 * @brief  Initialize all map elements matching the selector.
	 * @details  Creates one `AppMap` instance per matching element and initializes each instance.
	 * @param {string} [selector=AppMap.DEFAULT_SELECTOR] - CSS selector for map elements.
	 * @returns {Array<AppMap>} Initialized map instances.
	 */
	static initAll(selector = AppMap.DEFAULT_SELECTOR) {
		const elements = Array.from(document.querySelectorAll(selector))
		return elements.map((element) => new AppMap(element).init())
	}

	/**
	 * @brief  Construct a new map wrapper for a single DOM element.
	 * @details  Stores the element reference and prepares an instance slot for the Leaflet map.
	 * @param {HTMLElement} element - Target map container element.
	 */
	constructor(element) {
		this.element = element
		this.instance = null
		this.markers = []
		this.initialCenter = null
		this.centerControlButton = null
	}

	/**
	 * @brief  Initialize a Leaflet map for the current element.
	 * @details  Reads center coordinates from dataset attributes, configures tiles, markers, and attribution, and returns the current instance.
	 * @returns {AppMap} Current AppMap instance.
	 */
	init() {
		if (!this.element) return this

		const center = this.readCenter()
		this.initialCenter = center
		const datasetMarkers = this.readDatasetMarkers(center)

		this.instance = this.createMap(center.latitude, center.longitude)
		this.addTileLayer()
		const markers = this.addMarkers(datasetMarkers, center)
		this.markers.push(...markers)
		this.addAttribution()

		if (this.element.dataset.schoolMarker === 'true') {
			this.addSchoolMarker()
		}

		this.addCenterControl()

		return this
	}

	/**
	 * @brief  Read the center coordinates from element dataset values.
	 * @details  Parses latitude and longitude from data attributes and returns null when values are invalid.
	 * @returns {{latitude: number, longitude: number}|null} Parsed center coordinates.
	 */
	readCenter() {
		const centerFromDatasetMarkers = this.readCenterFromDatasetMarkers()
		if (centerFromDatasetMarkers) return centerFromDatasetMarkers

		if (this.element.dataset.schoolMarker === 'true') {
			const schoolMarker = this.getSchoolMarkerData()
			return {
				latitude: schoolMarker.latitude,
				longitude: schoolMarker.longitude
			}
		}

		return AppMap.DEFAULT_CENTER_BELGIUM
	}

	readCenterFromDatasetMarkers() {
		const parsedMarkers = this.parseDatasetMarkers()
		if (parsedMarkers.length === 0) return null

		const markerCoordinates = parsedMarkers
			.map((marker) => {
				const latitude = Number(marker?.latitude ?? marker?.lat)
				const longitude = Number(marker?.longitude ?? marker?.lon)
				if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
					return null
				}
				return { latitude, longitude }
			})
			.filter(Boolean)

		if (markerCoordinates.length === 0) return null

		const averageLatitude =
			markerCoordinates.reduce(
				(sum, marker) => sum + marker.latitude,
				0
			) / markerCoordinates.length
		const averageLongitude =
			markerCoordinates.reduce(
				(sum, marker) => sum + marker.longitude,
				0
			) / markerCoordinates.length

		return {
			latitude: averageLatitude,
			longitude: averageLongitude
		}
	}

	parseDatasetMarkers() {
		const rawMarkers = this.element?.dataset?.markers
		if (!rawMarkers) return []

		try {
			const parsed = JSON.parse(rawMarkers)
			return Array.isArray(parsed) ? parsed : []
		} catch {
			return []
		}
	}

	calculateCenter() {
		const validMarkers = (this.markers || []).filter(Boolean)
		if (validMarkers.length === 0) return null
		const latitudes = validMarkers.map((marker) => marker.getLatLng().lat)
		const longitudes = validMarkers.map((marker) => marker.getLatLng().lng)
		const averageLatitude =
			latitudes.reduce((sum, lat) => sum + lat, 0) / latitudes.length
		const averageLongitude =
			longitudes.reduce((sum, lng) => sum + lng, 0) / longitudes.length
		return { latitude: averageLatitude, longitude: averageLongitude }
	}

	getMarkerBounds() {
		const validMarkers = (this.markers || []).filter(Boolean)
		if (validMarkers.length === 0) {
			return null
		}

		const markerLatLngs = validMarkers.map((marker) => marker.getLatLng())
		return L.latLngBounds(markerLatLngs)
	}

	centerMap() {
		if (!this.instance) return

		const markerBounds = this.getMarkerBounds()
		if (markerBounds && markerBounds.isValid()) {
			this.instance.fitBounds(markerBounds, {
				padding: [18, 18],
				maxZoom: 16,
				animate: true
			})
			return
		}

		const center = this.initialCenter || this.calculateCenter()
		if (center) {
			this.instance.setView([center.latitude, center.longitude], 16)
		}
	}

	addCenterControl() {
		if (!this.instance || this.centerControlButton) return null

		const controlContainer = this.instance.zoomControl?.getContainer?.()
		if (!controlContainer) return null

		const centerButton = document.createElement('a')
		centerButton.href = '#'
		centerButton.className = 'leaflet-control-center'
		centerButton.title = 'Kaart centreren'
		centerButton.setAttribute('aria-label', 'Kaart centreren')
		centerButton.innerHTML =
			'<span aria-hidden="true"><i class="fas fa-location-crosshairs"></i></span>'

		L.DomEvent.disableClickPropagation(centerButton)
		L.DomEvent.disableScrollPropagation(centerButton)
		L.DomEvent.on(centerButton, 'click', (event) => {
			L.DomEvent.preventDefault(event)
			this.centerMap()
		})

		const zoomOutButton = controlContainer.querySelector(
			'.leaflet-control-zoom-out'
		)
		if (zoomOutButton && zoomOutButton.parentNode === controlContainer) {
			controlContainer.insertBefore(centerButton, zoomOutButton)
		} else {
			controlContainer.appendChild(centerButton)
		}

		this.centerControlButton = centerButton
		return centerButton
	}

	/**
	 * @brief  Parse marker data from the element dataset.
	 * @details  Reads JSON marker payloads, normalizes each marker, and filters out invalid entries.
	 * @param {{latitude: number, longitude: number}} center - Fallback center coordinates.
	 * @returns {Array<object>} Normalized marker objects.
	 */
	readDatasetMarkers(center) {
		return this.parseDatasetMarkers()
			.map((marker) => this.normalizeMarker(marker, center))
			.filter(Boolean)
	}

	/**
	 * @brief  Normalize a marker object into the expected internal shape.
	 * @details  Resolves coordinates, titles, address lines, map links, and popup behavior with safe defaults.
	 * @param {object} marker - Raw marker object.
	 * @param {{latitude: number, longitude: number}} fallbackCenter - Fallback coordinates.
	 * @returns {{latitude: number, longitude: number, title: string, lines: Array<string>, mapsUrl: string, openPopup: boolean}|null} Normalized marker or null when invalid.
	 */
	normalizeMarker(marker, fallbackCenter) {
		if (!marker || typeof marker !== 'object') {
			return null
		}

		const latitude = Number(
			marker.latitude ?? marker.lat ?? fallbackCenter?.latitude
		)
		const longitude = Number(
			marker.longitude ?? marker.lon ?? fallbackCenter?.longitude
		)

		if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
			return null
		}

		return {
			latitude,
			longitude,
			title: `${marker.title || marker.fullName || 'Locatie'}`,
			icon: marker.icon || null,
			lines: Array.isArray(marker.lines)
				? marker.lines
				: [marker.addressLineOne || '', marker.addressLineTwo || ''],
			mapsUrl:
				marker.mapsUrl ||
				this.generateGoogleMapsLink(latitude, longitude),
			openPopup: Boolean(marker.openPopup)
		}
	}

	/**
	 * @brief  Build a Google Maps search URL for coordinates.
	 * @details  Encodes latitude and longitude so users can open the same location in Google Maps.
	 * @param {number} latitude - Marker latitude.
	 * @param {number} longitude - Marker longitude.
	 * @returns {string} Google Maps search URL.
	 */
	generateGoogleMapsLink(latitude, longitude) {
		return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`
	}

	/**
	 * @brief  Create and configure the Leaflet map instance.
	 * @details  Applies zoom constraints, Belgian bounds, and interaction defaults.
	 * @param {number} latitude - Initial center latitude.
	 * @param {number} longitude - Initial center longitude.
	 * @returns {object} Leaflet map instance.
	 */
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

	/**
	 * @brief  Add the OpenStreetMap tile layer to the active map.
	 * @details  No-op when the map instance has not been initialized.
	 * @returns {void}
	 */
	addTileLayer() {
		if (!this.instance) return
		L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(
			this.instance
		)
	}

	/**
	 * @brief  Create the custom icon used for map markers.
	 * @details  Uses a Font Awesome house icon inside a Leaflet div icon wrapper.
	 * @returns {object} Leaflet div icon instance.
	 */
	createMarkerIcon(icon) {
		return L.divIcon({
			className: 'custom-div-icon',
			html: `<i class="fas ${icon || 'fa-house'} text-[1.25rem] theme-accent-text"></i>`,
			iconSize: [24, 24],
			iconAnchor: [12, 12],
			popupAnchor: [0, -6]
		})
	}

	/**
	 * @brief  Build popup card content for a marker.
	 * @details  Creates a DOM fragment with title, address lines, and optional external Google Maps link.
	 * @param {{title: string, lines: Array<string>, mapsUrl?: string}} details - Marker display details.
	 * @returns {HTMLDivElement} Popup content element.
	 */
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

	/**
	 * @brief  Add a single normalized marker to the map.
	 * @details  Creates marker and popup instances and optionally opens the popup immediately.
	 * @param {{latitude: number, longitude: number, title: string, lines: Array<string>, mapsUrl?: string, openPopup?: boolean, icon?: string}} normalized - Normalized marker payload.
	 * @returns {object|null} Leaflet marker or null when prerequisites are missing.
	 */
	addNormalizedMarker(normalized) {
		if (!this.instance || !normalized) {
			return null
		}

		const marker = L.marker([normalized.latitude, normalized.longitude], {
			title: normalized.title,
			icon: this.createMarkerIcon(normalized.icon)
		}).addTo(this.instance)

		const popup = L.popup([normalized.latitude, normalized.longitude], {
			closeButton: false,
			autoClose: false,
			closeOnClick: true,
			className: 'map-popup',
			content: this.buildPopupCard(normalized)
		})

		marker.bindPopup(popup)
		if (normalized.openPopup) {
			marker.openPopup()
		}
		return marker
	}

	addSchoolMarker() {
		if (!this.instance) return null

		const marker = this.getSchoolMarkerData()

		const normalized = this.normalizeMarker(marker, this.readCenter())
		const schoolMarker = this.addNormalizedMarker(normalized)
		if (schoolMarker) {
			this.markers.push(schoolMarker)
		}

		return schoolMarker
	}

	getSchoolMarkerData() {
		return {
			title: 'SILA Westerlo Bovenschool',
			lines: ['Denis Voetsstraat 21', '2260 Westerlo'],
			mapsUrl:
				'https://www.google.com/maps/search/?api=1&query=Denis+Voetsstraat+21%2C+2260+Westerlo',
			icon: 'fa-school',
			latitude: 51.08839307348528,
			longitude: 4.911829081837887
		}
	}

	/**
	 * @brief  Add all markers to the map.
	 * @details  Normalizes each marker, applies default popup behavior, and returns successfully rendered markers.
	 * @param {Array<object>} [markers=[]] - Marker list.
	 * @returns {Array<object>} Rendered Leaflet markers.
	 */
	addMarkers(markers = [], fallbackCenter = this.initialCenter) {
		if (!this.instance || !Array.isArray(markers) || markers.length === 0) {
			return []
		}

		return markers
			.map((marker, index) => {
				const normalized = this.normalizeMarker(marker, fallbackCenter)
				if (!normalized) {
					return null
				}

				if (typeof marker.openPopup === 'undefined') {
					normalized.openPopup = index === 0
				}

				return this.addNormalizedMarker(normalized)
			})
			.filter(Boolean)
	}

	/**
	 * @brief  Add attribution controls to the map.
	 * @details  Appends required attribution entries for map tiles and data providers.
	 * @returns {void}
	 */
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

	/**
	 * @brief  Show a fallback message when no valid coordinates are available.
	 * @details  Replaces map content with a styled explanatory message.
	 * @returns {void}
	 */
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
document.addEventListener('DOMContentLoaded', () => AppMap.initAll())
