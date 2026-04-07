import express from 'express'
import {
	getAdminPage,
	getUsersPage,
	getUsersNewPage,
	postUserNewPage,
	getUserPage,
	getUserEditPage,
	postUserEditPage,
	getSettingsPage,
	postSettingsPage
} from '../controllers/admin.controller.js'

const router = express.Router()

router.get('/', getAdminPage)
router.get('/users', getUsersPage)
router.get('/users/new', getUsersNewPage)
router.post('/users/new', postUserNewPage)
router.get('/users/:uid', getUserPage)
router.get('/users/:uid/edit', getUserEditPage)
router.post('/users/:uid/edit', postUserEditPage)
router.get('/settings', getSettingsPage)
router.post('/settings', postSettingsPage)

export default router
