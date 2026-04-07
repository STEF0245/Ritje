/**
 * @file Leaflet map bootstrap for profile and admin location views.
 * @brief  Summary: Renders map markers and popup content from server-provided data.
 * @details  Details: This script defines the AppMap class which initializes Leaflet maps on elements with the `data-map` attribute. It reads center coordinates and marker data from the element's dataset, creates a map instance, adds tile layers, and renders markers with custom icons and popups. The map is constrained to Belgian boundaries and includes proper attribution. If no valid coordinates are provided, it shows a user-friendly message instead of the map.
 */

class AppMap {
	static MAP_BOUNDS_BELGIUM = [
		[51.5051, 6.4081],
		[49.497, 2.5407]
	]

	static DEFAULT_SELECTOR = '[data-map]'

	/**
	 * @brief  Summary: Initialize all map elements matching the selector.
	 * @details  Details: Creates one `AppMap` instance per matching element and initializes each instance.
	 * @param {string} [selector=AppMap.DEFAULT_SELECTOR] - CSS selector for map elements.
	 * @returns {Array<AppMap>} Initialized map instances.
	 */
	static initAll(selector = AppMap.DEFAULT_SELECTOR) {
		const elements = Array.from(document.querySelectorAll(selector))
		return elements.map((element) => new AppMap(element).init())
	}

	/**
	 * @brief  Summary: Construct a new map wrapper for a single DOM element.
	 * @details  Details: Stores the element reference and prepares an instance slot for the Leaflet map.
	 * @param {HTMLElement} element - Target map container element.
	 */
	constructor(element) {
		this.element = element
		this.instance = null
	}

	/**
	 * @brief  Summary: Initialize a Leaflet map for the current element.
	 * @details  Details: Reads center coordinates from dataset attributes, configures tiles, markers, and attribution, and returns the current instance.
	 * @returns {AppMap} Current AppMap instance.
	 */
	init() {
		if (!this.element) return this

		const center = this.readCenter()
		if (!center) {
			this.showNoCoordinatesMessage()
			return this
		}

		this.instance = this.createMap(center.latitude, center.longitude)
		this.addTileLayer()
		this.addMarkers(this.readDatasetMarkers(center))
		this.addAttribution()

		return this
	}

	/**
	 * @brief  Summary: Read the center coordinates from element dataset values.
	 * @details  Details: Parses latitude and longitude from data attributes and returns null when values are invalid.
	 * @returns {{latitude: number, longitude: number}|null} Parsed center coordinates.
	 */
	readCenter() {
		const latitude = parseFloat(this.element.dataset.latitude || '')
		const longitude = parseFloat(this.element.dataset.longitude || '')

		if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
			return null
		}

		return { latitude, longitude }
	}

	/**
	 * @brief  Summary: Parse marker data from the element dataset.
	 * @details  Details: Reads JSON marker payloads, normalizes each marker, and filters out invalid entries.
	 * @param {{latitude: number, longitude: number}} center - Fallback center coordinates.
	 * @returns {Array<object>} Normalized marker objects.
	 */
	readDatasetMarkers(center) {
		const rawMarkers = this.element.dataset.markers
		if (rawMarkers) {
			try {
				const parsed = JSON.parse(rawMarkers)
				if (Array.isArray(parsed)) {
					return parsed
						.map((marker) => this.normalizeMarker(marker, center))
						.filter(Boolean)
				}
			} catch {
				return []
			}
		}

		return []
	}

	/**
	 * @brief  Summary: Normalize a marker object into the expected internal shape.
	 * @details  Details: Resolves coordinates, titles, address lines, map links, and popup behavior with safe defaults.
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
	 * @brief  Summary: Build a Google Maps search URL for coordinates.
	 * @details  Details: Encodes latitude and longitude so users can open the same location in Google Maps.
	 * @param {number} latitude - Marker latitude.
	 * @param {number} longitude - Marker longitude.
	 * @returns {string} Google Maps search URL.
	 */
	generateGoogleMapsLink(latitude, longitude) {
		return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`
	}

	/**
	 * @brief  Summary: Create and configure the Leaflet map instance.
	 * @details  Details: Applies zoom constraints, Belgian bounds, and interaction defaults.
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
	 * @brief  Summary: Add the OpenStreetMap tile layer to the active map.
	 * @details  Details: No-op when the map instance has not been initialized.
	 * @returns {void}
	 */
	addTileLayer() {
		if (!this.instance) return
		L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(
			this.instance
		)
	}

	/**
	 * @brief  Summary: Create the custom icon used for map markers.
	 * @details  Details: Uses a Font Awesome house icon inside a Leaflet div icon wrapper.
	 * @returns {object} Leaflet div icon instance.
	 */
	createMarkerIcon() {
		return L.divIcon({
			className: 'custom-div-icon',
			html: '<i class="fas fa-house text-[1.25rem] theme-accent-text"></i>',
			iconSize: [24, 24],
			iconAnchor: [12, 12],
			popupAnchor: [0, -6]
		})
	}

	/**
	 * @brief  Summary: Build popup card content for a marker.
	 * @details  Details: Creates a DOM fragment with title, address lines, and optional external Google Maps link.
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
	 * @brief  Summary: Add a single normalized marker to the map.
	 * @details  Details: Creates marker and popup instances and optionally opens the popup immediately.
	 * @param {{latitude: number, longitude: number, title: string, lines: Array<string>, mapsUrl?: string, openPopup?: boolean}} normalized - Normalized marker payload.
	 * @returns {object|null} Leaflet marker or null when prerequisites are missing.
	 */
	addNormalizedMarker(normalized) {
		if (!this.instance || !normalized) {
			return null
		}

		const marker = L.marker([normalized.latitude, normalized.longitude], {
			title: normalized.title,
			icon: this.createMarkerIcon()
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

	/**
	 * @brief  Summary: Add all markers to the map.
	 * @details  Details: Normalizes each marker, applies default popup behavior, and returns successfully rendered markers.
	 * @param {Array<object>} [markers=[]] - Marker list.
	 * @returns {Array<object>} Rendered Leaflet markers.
	 */
	addMarkers(markers = []) {
		if (!this.instance || !Array.isArray(markers) || markers.length === 0) {
			return []
		}

		return markers
			.map((marker, index) => {
				const normalized = this.normalizeMarker(
					marker,
					this.readCenter()
				)
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
	 * @brief  Summary: Add attribution controls to the map.
	 * @details  Details: Appends required attribution entries for map tiles and data providers.
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
	 * @brief  Summary: Show a fallback message when no valid coordinates are available.
	 * @details  Details: Replaces map content with a styled explanatory message.
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
