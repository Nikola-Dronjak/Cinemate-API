const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const { userController } = require('../controllers/userController');

// Set up multer storage configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'images/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = crypto.randomBytes(16).toString('hex');
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Get all users:
router.get('/api/users', [authenticate, authorize(['Admin'])], userController.getUsers);

// Get a specific user:
router.get('/api/users/:id', authenticate, userController.getUser);

// Register a new user:
router.post('/api/users/register', upload.single('profilePicture'), userController.registerUser);

// Login an existing user:
router.post('/api/users/login', userController.loginUser);

// Logout an existing user:
router.post('/api/users/logout', authenticate, userController.logoutUser);

// Refresh token:
router.post('/api/users/refresh-token', userController.refreshAccessToken);

// Update a user:
router.put('/api/users/:id', [authenticate, upload.single('profilePicture')], userController.updateUser);

// Change the role of a specific user:
router.patch('/api/users/:id/role', [authenticate, authorize(['Admin'])], userController.changeUserRole);

// Remove a user:
router.delete('/api/users/:id', authenticate, userController.deleteUser);

module.exports = router;