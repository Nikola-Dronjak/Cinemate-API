const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const { cinemaController } = require('../controllers/cinemaController');

// Get all cinemas:
router.get('/api/cinemas', [authenticate, authorize(['Admin', 'Sales'])], cinemaController.getCinemas);

// Get a specific cinema:
router.get('/api/cinemas/:id', cinemaController.getCinema);

// Create a cinema:
router.post('/api/cinemas', [authenticate, authorize(['Admin'])], cinemaController.createCinema);

// Update a cinema:
router.put('/api/cinemas/:id', [authenticate, authorize(['Admin'])], cinemaController.updateCinema);

// Remove a cinema:
router.delete('/api/cinemas/:id', [authenticate, authorize(['Admin'])], cinemaController.deleteCinema);

module.exports = router;