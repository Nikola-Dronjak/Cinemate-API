const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');

const { reservationController } = require('../controllers/reservationController');

// Get all reservations for a specific user
router.get('/api/users/:userId/reservations', authenticate, reservationController.getReservationsOfUser);

// Create a PayPal order:
router.post('/api/reservations', authenticate, reservationController.createReservation);

// Confirm the PayPal order and finalize the reservation:
router.post('/api/reservations/:orderId', authenticate, reservationController.confirmReservation);

// Remove a reservation:
router.delete('/api/reservations/:id', authenticate, reservationController.deleteReservation);

module.exports = router;