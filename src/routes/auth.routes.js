import express from 'express'
import config from '../config.js'
import {
	getLoginPage,
	loginController,
	logoutController
} from '../controllers/auth.controller.js'

const router = express.Router()

router.get('/login', getLoginPage)
router.post('/login', loginController)
router.post('/logout', logoutController)
router.get('/api/firebase-config', (req, res) => {
	res.json(config.firebase.web)
})

export default router
