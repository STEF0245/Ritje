/**
 * @file Express application bootstrap and shared middleware registration.
 * @brief  Configures security, templates, and route mounting for Ritje.
 * @details  This module sets up the Express app with global middleware for logging, security headers, JSON parsing, and cookie handling. It also mounts the main route handlers and error handling middleware. The configured app instance is exported for use in the HTTP server bootstrap.
 */

import express from 'express'
import cookieParser from 'cookie-parser'
import path from 'node:path'
import morgan from 'morgan'
import helmet from 'helmet'

// =====================
// Importing modules
// =====================
import config from './config.js'
import notFoundHandler from './middleware/notFound.middleware.js'
import errorHandler from './middleware/error.middleware.js'
import { requireAuth, requireAdmin } from './middleware/auth.middleware.js'
import checkMaintenanceMode from './middleware/maintenance.middleware.js'
import authRoutes from './auth/auth.routes.js'
import profileRoutes from './profile/profile.routes.js'
import adminRoutes from './admin/admin.routes.js'
import locationRoutes from './location/location.routes.js'
import rideRoutes from './ride/ride.routes.js'

const app = express()

// =====================
// Logging setup
// =====================
app.use(morgan(config.isProduction ? 'combined' : 'dev'))

// =====================
// Middleware setup
// =====================
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.use(cookieParser())

// Dynamic CSP middleware to support both localhost and IP access
app.use((req, res, next) => {
	const host = req.get('host')
	const protocol = req.protocol
	const origin = `${protocol}://${host}`

	const cspDirectives = [
		`default-src 'self' ${origin}`,
		`script-src 'self' 'unsafe-inline' https://www.gstatic.com https://unpkg.com https://cdn.jsdelivr.net`,
		`style-src 'self' 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net`,
		`img-src 'self' data: https:`,
		`font-src 'self' data:`,
		`connect-src 'self' ${origin} https://www.googleapis.com https://cdn.jsdelivr.net https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://nominatim.openstreetmap.org https://api.geoapify.com https://unpkg.com https://www.gstatic.com`,
		`base-uri 'self' ${origin}`,
		`form-action 'self' ${origin}`,
		`frame-ancestors 'none'`
	].join('; ')

	res.setHeader('Content-Security-Policy', cspDirectives)
	next()
})

app.use(
	helmet({
		contentSecurityPolicy: false,
		referrerPolicy: { policy: 'origin-when-cross-origin' },
		frameguard: { action: 'deny' }
	})
)

app.use((req, res, next) => {
	res.setHeader(
		'Permissions-Policy',
		'camera=(), microphone=(), geolocation=()'
	)
	next()
})

// CSRF mitigation: reject cross-origin state-changing browser requests.
app.use((req, res, next) => {
	const method = req.method.toUpperCase()
	if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
		return next()
	}

	const origin = req.get('origin')
	if (!origin || origin === 'null') {
		return next()
	}

	const expectedOrigin = `${req.protocol}://${req.get('host')}`
	if (origin !== expectedOrigin) {
		return res.status(403).json({
			message: 'Cross-origin request blocked',
			origin,
			expectedOrigin
		})
	}

	next()
})

// =====================
// Static files setup
// =====================
app.use(
	express.static(path.join(process.cwd(), 'public'), {
		maxAge: config.isProduction ? '7d' : '0',
		etag: true,
		immutable: config.isProduction
	})
)

// JSDoc output (admin-only)
app.use('/admin/api-docs', (req, res, next) => {
	express.static(path.join(process.cwd(), 'docs'), {
		maxAge: config.isProduction ? '1d' : '0',
		etag: true,
		immutable: false
	})(req, res, next)
})

// =====================
// JSON Response Formatting
// =====================
app.set('json spaces', 2)

// =====================
// Template Engine
// =====================
app.set('view engine', 'ejs')
app.set('views', path.join(process.cwd(), 'views'))

// Disable view caching in development
if (!config.isProduction) {
	app.set('view cache', false)
}

// =====================
// Global Middleware
// =====================
app.use(requireAuth)
app.use((req, res, next) => {
	res.locals.user = req.user || null
	const flashNotification = req.cookies.flashNotification
	if (flashNotification) {
		try {
			res.locals.notifications = [
				JSON.parse(decodeURIComponent(flashNotification))
			]
		} catch {
			res.locals.notifications = []
		}
		res.clearCookie('flashNotification', { path: '/' })
	} else {
		res.locals.notifications = []
	}
	next()
})
app.use(checkMaintenanceMode)

// =====================
// Routes setup
// =====================
app.use('/', authRoutes)
app.use('/', profileRoutes)
app.use('/ride', rideRoutes)
app.use('/admin', requireAdmin, adminRoutes)
app.use('/api/location', locationRoutes)
app.use(notFoundHandler)
app.use(errorHandler)

export default app
