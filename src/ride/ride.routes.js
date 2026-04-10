/**
 * @file Ride routes for the main ride page.
 * @brief Defines the route for the ride page and applies any necessary middleware.
 * @details Sets up the GET endpoint for the ride page and includes rate limiting to prevent abuse of the ride page access.
 */

import express from 'express'
import { getRidePage } from './ride.controller.js'

const router = express.Router()

router.get('/', getRidePage)

export default router
