const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

const { screeningController } = require('../controllers/screeningController');

// Get screenings of movie:
router.get('/api/movies/:movieId/screenings', screeningController.getScreeningsOfMovie);

// Get screenings for hall:
router.get('/api/halls/:hallId/screenings', screeningController.getScreeningsForHall);

// Get a specific screening:
router.get('/api/screenings/:id', screeningController.getScreening);

// Create a screening:
router.post('/api/screenings', [auth, admin], screeningController.createScreening);

// Update a screening:
router.put('/api/screenings/:id', [auth, admin], screeningController.updateScreening);

// Add a discount for a specific screening:
router.put('/api/screenings/:id/discount', [auth, admin], screeningController.addDiscount);

// Remove a screening:
router.delete('/api/screenings/:id', [auth, admin], screeningController.deleteScreening);

module.exports = router;