/**
 * @file Admin routes for dashboard, user management, and settings.
 * @brief  Mounts the protected admin area endpoints.
 * @details  Defines route-to-controller mappings for all admin pages and user/settings mutations.
 */

import express from 'express'
import {
	getAdminPage,
	getUsersPage,
	getUsersNewPage,
	postUserNewPage,
	getUserPage,
	getUserEditPage,
	postUserEditPage,
	deleteUserController,
	getSettingsPage,
	postSettingsPage,
	getDocumentationPage
} from './admin.controller.js'

const router = express.Router()

router.get('/', getAdminPage)
router.get('/users', getUsersPage)
router.get('/users/new', getUsersNewPage)
router.post('/users/new', postUserNewPage)
router.get('/users/:uid', getUserPage)
router.get('/users/:uid/edit', getUserEditPage)
router.post('/users/:uid/edit', postUserEditPage)
router.get('/users/:uid/delete', deleteUserController)
router.get('/settings', getSettingsPage)
router.post('/settings', postSettingsPage)
router.get('/docs', getDocumentationPage)

export default router
