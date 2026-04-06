import express from 'express'
import {
	getAdminPage,
	getUsersPage,
	getUsersNewPage,
	postUserNewPage,
	getUserPage,
	getUserEditPage,
	postUserEditPage,
	getSettingsPage
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

export default router
