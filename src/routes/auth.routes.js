import express from 'express'
import {
	getLoginPage,
	loginController,
	logoutController
} from '../controllers/auth.controller.js'

const router = express.Router()

router.get('/login', getLoginPage)
router.post('/login', loginController)
router.post('/logout', logoutController)

export default router
