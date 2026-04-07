// =====================
// Importing dependencies
// =====================
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
import authRoutes from './routes/auth.routes.js'
import profileRoutes from './routes/profile.routes.js'
import adminRoutes from './routes/admin.routes.js'
import locationRoutes from './routes/location.routes.js'

// =====================
// Initializing the app
// =====================
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

app.use(
	helmet({
		contentSecurityPolicy: {
			directives: {
				defaultSrc: ["'self'"],
				scriptSrc: [
					"'self'",
					"'unsafe-inline'",
					'https://www.gstatic.com',
					'https://unpkg.com',
					'https://cdn.jsdelivr.net'
				],
				styleSrc: [
					"'self'",
					"'unsafe-inline'",
					'https://unpkg.com',
					'https://cdn.jsdelivr.net'
				],
				imgSrc: ["'self'", 'data:', 'https:'],
				fontSrc: ["'self'", 'data:'],
				connectSrc: [
					"'self'",
					'https://www.googleapis.com',
					'https://cdn.jsdelivr.net',
					'https://identitytoolkit.googleapis.com',
					'https://securetoken.googleapis.com',
					'https://nominatim.openstreetmap.org',
					'https://api.geoapify.com',
					'https://unpkg.com',
					'https://www.gstatic.com'
				],
				baseUri: ["'self'"],
				formAction: ["'self'"],
				frameAncestors: ["'none'"]
			}
		},
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
app.use(requireAuth) // Add user to all requests if authenticated
app.use((req, res, next) => {
	res.locals.user = req.user || null // Make user available in all views
	res.locals.pageError = null
	res.locals.notifications = [] // Placeholder for future notifications
	next()
})
app.use(checkMaintenanceMode) // Check if the site is in maintenance mode

// =====================
// Routes setup
// =====================
app.use('/', authRoutes)
app.use('/', profileRoutes)
app.use('/admin', requireAdmin, adminRoutes)
app.use('/api/location', locationRoutes)

app.use(notFoundHandler)
app.use(errorHandler)

export default app
