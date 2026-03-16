import express from 'express'

const router = express.Router()

// Home page
router.get('/', (req, res) => {
	res.render('home', { title: 'Welkom bij Ritje!' })
})

export default router
