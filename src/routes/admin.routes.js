import express from 'express'
import { getAdminPage, getUsersPage } from '../controllers/admin.controller.js'

const router = express.Router()

router.get('/', getAdminPage)
router.get('/users', getUsersPage)

export default router
