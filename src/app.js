// =====================
// Importing dependencies
// =====================
import express from 'express'
import cookieParser from 'cookie-parser'
import path from 'path'

// =====================
// Importing modules
// =====================
import { config } from './config/env.config.js'
import { loggingMiddleware } from './misc/logging.middleware.js'
import pageRoutes from './routes/page.routes.js'
import authRoutes from './routes/auth.routes.js'

// =====================
// Initializing the app
// =====================
const app = express()

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
app.use(loggingMiddleware)
app.use(optionalAuth) // Add user to all requests if authenticated

// =====================
// Routes setup
// =====================
app.use('/', pageRoutes)
app.use('/auth', authRoutes)
