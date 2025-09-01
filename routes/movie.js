const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const { movieController } = require('../controllers/movieController');

// Set up multer storage configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'images/');
    },
    filename: (req, file, cb) => {
        const hash = crypto.createHash('sha256')
            .update(file.originalname)
            .digest('hex');
        const ext = path.extname(file.originalname);
        cb(null, `${hash}${ext}`);
    }
});

const upload = multer({ storage: storage });

// Get all movies:
router.get('/api/movies', movieController.getMovies);

// Get a specific movie along with all its screenings:
router.get('/api/movies/:id', movieController.getMovie);

// Create a movie:
router.post('/api/movies', [authenticate, authorize(['Admin', 'Sales']), upload.single('image')], movieController.createMovie);

// Update a movie:
router.put('/api/movies/:id', [authenticate, authorize(['Admin', 'Sales']), upload.single('image')], movieController.updateMovie);

// Remove a movie:
router.delete('/api/movies/:id', [authenticate, authorize(['Admin', 'Sales'])], movieController.deleteMovie);

module.exports = router;