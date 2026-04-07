/**
 * @file HTTP server bootstrap for the Ritje application.
 * @brief Starts the Express app and handles graceful shutdown signals.
 */

import app from './app.js'
import config from './config.js'

// =====================
// Start the server
// =====================
const server = app.listen(config.port, () => {
	console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
	console.log(`🚀 Server running on http://localhost:${config.port}`)
	console.log(`📦 Environment: ${config.nodeEnv}`)
	console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
})

// =====================
// Graceful Shutdown
// =====================
/**
 * @brief Close the HTTP server and terminate the process cleanly.
 * @param {string} signal - Shutdown trigger name.
 * @returns {Promise<void>} Resolves after the server is closed.
 */
const shutdown = async (signal) => {
	console.log(`\n⚠️  Received ${signal}. Shutting down gracefully...`)

	try {
		await new Promise((resolve, reject) => {
			server.close((error) => {
				if (error) {
					reject(error)
					return
				}

				resolve()
			})
		})

		console.log('✓ HTTP server closed.')

		console.log('✓ Graceful shutdown complete.')
		process.exit(0)
	} catch (err) {
		console.error('❌ Error during shutdown:', err)
		process.exit(1)
	}
}

process.on('SIGINT', () => shutdown('SIGINT')) // Ctrl+C
process.on('SIGTERM', () => shutdown('SIGTERM')) // Docker / hosting platforms

// =====================
// Fatal Error Handling
// =====================
process.on('uncaughtException', (err) => {
	console.error('❌ Uncaught Exception:', err)
	shutdown('uncaughtException')
})

process.on('unhandledRejection', (reason, promise) => {
	console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason)
	shutdown('unhandledRejection')
})
