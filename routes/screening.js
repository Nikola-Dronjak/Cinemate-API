const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const { screeningController } = require('../controllers/screeningController');

// Get screenings of movie:
router.get('/api/movies/:movieId/screenings', screeningController.getScreeningsOfMovie);

// Get screenings for hall:
router.get('/api/halls/:hallId/screenings', screeningController.getScreeningsForHall);

// Get a specific screening:
router.get('/api/screenings/:id', screeningController.getScreening);

// Create a screening:
router.post('/api/screenings', [authenticate, authorize(['Admin', 'Sales'])], screeningController.createScreening);

// Update a screening:
router.put('/api/screenings/:id', [authenticate, authorize(['Admin', 'Sales'])], screeningController.updateScreening);

// Add a discount for a specific screening:
router.put('/api/screenings/:id/discount', [authenticate, authorize(['Admin', 'Sales'])], screeningController.addDiscount);

// Remove a screening:
router.delete('/api/screenings/:id', [authenticate, authorize(['Admin', 'Sales'])], screeningController.deleteScreening);

module.exports = router;