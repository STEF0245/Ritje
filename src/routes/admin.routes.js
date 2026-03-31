import express from 'express'
import {
	getAdminPage,
	getUsersPage,
	getUsersNewPage,
	getUserEditPage,
	postUserEditPage,
	getSettingsPage
} from '../controllers/admin.controller.js'

const router = express.Router()

router.get('/', getAdminPage)
router.get('/users', getUsersPage)
router.get('/users/new', getUsersNewPage)
router.get('/users/:uid', getUserEditPage)
router.post('/users/:uid', postUserEditPage)
router.get('/settings', getSettingsPage)

export default router
