const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

const { reservationController } = require('../controllers/reservationController');

// Get all reservations for a specific user
router.get('/api/users/:userId/reservations', auth, reservationController.getReservationsOfUser);

// Create a reservation:
router.post('/api/reservations', auth, reservationController.createReservation);

// Remove a reservation:
router.delete('/api/reservations/:id', auth, reservationController.deleteReservation);

module.exports = router;