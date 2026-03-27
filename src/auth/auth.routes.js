import express from 'express'
import {
	getLoginPage,
	getRegisterPage,
	loginController,
	registerController,
	logoutController
} from './auth.controller.js'

const router = express.Router()

router.get('/login', getLoginPage)
router.get('/register', getRegisterPage)
router.post('/register', registerController)
router.post('/login', loginController)
router.post('/logout', logoutController)

export default router
