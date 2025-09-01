const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const { hallController } = require('../controllers/hallController');

// Get all halls for a specific cinema:
router.get('/api/cinemas/:cinemaId/halls', [authenticate, authorize(['Admin', 'Sales'])], hallController.getHallsOfCinema);

// Get hall details along with its screenings and movie titles
router.get('/api/halls/:id', hallController.getHall);

// Create a hall:
router.post('/api/halls', [authenticate, authorize(['Admin'])], hallController.createHall);

// Update a hall:
router.put('/api/halls/:id', [authenticate, authorize(['Admin'])], hallController.updateHall);

// Remove a hall:
router.delete('/api/halls/:id', [authenticate, authorize(['Admin'])], hallController.deleteHall);

module.exports = router;