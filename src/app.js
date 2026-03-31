// =====================
// Importing dependencies
// =====================
import express from 'express'
import cookieParser from 'cookie-parser'
import path from 'node:path'
import morgan from 'morgan'

// =====================
// Importing modules
// =====================
import config from './config.js'
import notFoundHandler from './middleware/notFound.middleware.js'
import errorHandler from './middleware/error.middleware.js'
import { requireAuth, requireAdmin } from './middleware/auth.middleware.js'
import authRoutes from './routes/auth.routes.js'
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
	res.locals.notifications = [] // Placeholder for future notifications
	next()
})

// =====================
// Routes setup
// =====================
app.use('/', authRoutes)
app.use('/admin', requireAdmin, adminRoutes)
app.use('/api/location', locationRoutes)

app.use(notFoundHandler)
app.use(errorHandler)

export default app
