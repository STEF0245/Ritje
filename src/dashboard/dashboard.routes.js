import express from 'express'
import {
	getDashboardPage,
	cancelDashboardRide,
	respondToDashboardRide
} from './dashboard.controller.js'

const router = express.Router()

router.get('/', getDashboardPage)
router.get('/:day/:hour', getDashboardPage)
router.post('/:day/:hour/cancel', cancelDashboardRide)
router.post('/:day/:hour/respond', respondToDashboardRide)

export default router
