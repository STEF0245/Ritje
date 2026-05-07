import express from 'express'
import { getDashboardPage } from './dashboard.controller.js'

const router = express.Router()

router.get('/', getDashboardPage)
router.get('/:day/:hour', getDashboardPage)

export default router
