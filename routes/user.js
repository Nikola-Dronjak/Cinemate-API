const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const auth = require('../middleware/auth');

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

// Get a specific user:
router.get('/api/users/:id', auth, userController.getUser);

// Register a new user:
router.post('/api/users/register', upload.single('profilePicture'), userController.registerUser);

// Login an existing user:
router.post('/api/users/login', userController.loginUser);

// Update a user:
router.put('/api/users/:id', [auth, upload.single('profilePicture')], userController.updateUser);

// Remove a user:
router.delete('/api/users/:id', auth, userController.deleteUser);

module.exports = router;