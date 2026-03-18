// =====================
// Importing dependencies
// =====================
import express from 'express'
import cookieParser from 'cookie-parser'
import path from 'path'
import morgan from 'morgan'

// =====================
// Importing modules
// =====================
import { config } from './config/env.config.js'
import { errorHandler, notFoundHandler } from './misc/error.middleware.js'
import { optionalAuth } from './auth/auth.middleware.js'
import pageRoutes from './page/page.routes.js'
import authRoutes from './auth/auth.routes.js'
import rideRoutes from './ride/ride.routes.js'
import locationRoutes from './location/location.routes.js'

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
app.use(optionalAuth) // Add user to all requests if authenticated
app.use((req, res, next) => {
	res.locals.user = req.user || null // Make user available in all views
	next()
})

// =====================
// Routes setup
// =====================
app.use('/', pageRoutes)
app.use('/auth', authRoutes)
app.use('/ride', rideRoutes)
app.use('/api/location', locationRoutes)

app.use(notFoundHandler)
app.use(errorHandler)

export { app }
