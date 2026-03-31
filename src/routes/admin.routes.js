import express from 'express'
import {
	getAdminPage,
	getUsersPage,
	getSettingsPage
} from '../controllers/admin.controller.js'

const router = express.Router()

router.get('/', getAdminPage)
router.get('/users', getUsersPage)
router.get('/settings', getSettingsPage)

export default router
