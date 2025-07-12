const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

const { hallController } = require('../controllers/hallController');

// Get all halls for a specific cinema:
router.get('/api/cinemas/:cinemaId/halls', [auth, admin], hallController.getHallsOfCinema);

// Get hall details along with its screenings and movie titles
router.get('/api/halls/:id', hallController.getHall);

// Create a hall:
router.post('/api/halls', [auth, admin], hallController.createHall);

// Update a hall:
router.put('/api/halls/:id', [auth, admin], hallController.updateHall);

// Remove a hall:
router.delete('/api/halls/:id', hallController.deleteHall);

module.exports = router;