const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

const { cinemaController } = require('../controllers/cinemaController');

// Get all cinemas:
router.get('/', [auth, admin], cinemaController.getCinemas);

// Get a specific cinema:
router.get('/:id', cinemaController.getCinema);

// Create a cinema:
router.post('/', [auth, admin], cinemaController.createCinema);

// Update a cinema:
router.put('/:id', [auth, admin], cinemaController.updateCinema);

// Remove a cinema:
router.delete('/:id', [auth, admin], cinemaController.deleteCinema);

module.exports = router;