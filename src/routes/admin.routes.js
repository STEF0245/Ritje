import express from 'express'
import {
	getAdminPage,
	getUsersPage,
	getUserAddPage,
	getSettingsPage
} from '../controllers/admin.controller.js'

const router = express.Router()

router.get('/', getAdminPage)
router.get('/users', getUsersPage)
router.get('/users/add', getUserAddPage)
router.get('/settings', getSettingsPage)

export default router
