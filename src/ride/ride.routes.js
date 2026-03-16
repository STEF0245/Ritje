import express from 'express'

const router = express.Router()

// =====================
// Ride routes
// =====================
router.get('/', (req, res) => {
	res.render('ride_index', { title: 'Ritten' })
})

router.get('/offer', (req, res) => {
	res.render('ride_offer', { title: 'Rit Aanbieden' })
})

export default router
