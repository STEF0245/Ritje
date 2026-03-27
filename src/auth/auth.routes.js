import express from 'express'
import {
	getLoginPage,
	loginController,
	logoutController
} from './auth.controller.js'

const router = express.Router()

router.get('/login', getLoginPage)
router.get('/logout', logoutController)
router.post('/login', loginController)
router.post('/logout', logoutController)

export default router
