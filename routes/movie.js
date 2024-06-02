const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

const validateMovie = require('../validation/movieValidation');

const uri = "mongodb+srv://Admin:admin@cluster0.cv0sz3z.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

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

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// Get all movies:
router.get('/', async (req, res) => {
    try {
        await client.connect();

        const movies = await client.db('Cinemate').collection('movies').find().toArray();
        if (movies.length === 0) return res.status(404).send("There are no movies in the database right now.");
        return res.status(200).send(movies);
    } catch (error) {
        console.error(error.stack);
        return res.status(500).send("Internal Server Error");
    } finally {
        client.close();
    }
});

// Get a specific movie along with all its screenings:
router.get('/:id', async (req, res) => {
    try {
        await client.connect();

        const movie = await client.db('Cinemate').collection('movies').findOne({ _id: new ObjectId(req.params.id) });
        if (!movie) return res.status(404).send("There is no movie with the given id.");

        const screeningsPipeline = [
            { $match: { movieId: req.params.id } },
            {
                $lookup: {
                    from: 'halls',
                    let: { hallId: { $toObjectId: '$hallId' } },
                    pipeline: [
                        { $match: { $expr: { $eq: ['$_id', '$$hallId'] } } }
                    ],
                    as: 'hall'
                }
            },
            { $unwind: '$hall' },
            {
                $lookup: {
                    from: 'cinemas',
                    let: { cinemaId: { $toObjectId: '$hall.cinemaId' } },
                    pipeline: [
                        { $match: { $expr: { $eq: ['$_id', '$$cinemaId'] } } }
                    ],
                    as: 'cinema'
                }
            },
            { $unwind: '$cinema' },
            {
                $project: {
                    _id: 1,
                    movieId: 1,
                    hallId: 1,
                    'hall.name': 1,
                    'cinema.name': 1,
                    date: 1,
                    time: 1,
                    endTime: 1,
                    numberOfAvailableSeats: 1
                }
            }
        ];

        const screenings = await client.db('Cinemate').collection('screenings').aggregate(screeningsPipeline).toArray();
        return res.status(200).send({ movie: movie, screenings });
    } catch (error) {
        console.error(error.stack);
        return res.status(500).send("Internal Server Error");
    } finally {
        await client.close();
    }
});

const upload = multer({ storage: storage });

// Image upload:
router.post('/upload', [auth, admin, upload.single('image')], (req, res) => {
    if (!req.file) {
        return res.status(400).send('No image file uploaded.');
    }

    const imageUrl = req.file.filename;
    if (req.body.oldImageUrl) {
        const oldImagePath = path.join(__dirname, '../images', req.body.oldImageUrl);
        fs.unlink(oldImagePath, (err) => {
            if (err) {
                console.error(`Failed to delete old image: ${oldImagePath}`, err);
            }
        });
    }
    res.status(200).send({ imageUrl: imageUrl });
});

// Create a movie:
router.post('/', [auth, admin], async (req, res) => {
    try {
        await client.connect();

        const { error } = validateMovie(req.body);
        if (error) return res.status(400).send(error.details[0].message);

        const existingMovie = await client.db('Cinemate').collection('movies').findOne({ title: req.body.title });
        if (existingMovie !== null) return res.status(400).send("This movie already exists.");

        const newMovie = {
            title: req.body.title,
            description: req.body.description,
            genre: req.body.genre,
            director: req.body.director,
            releaseDate: req.body.releaseDate,
            duration: req.body.duration,
            image: req.body.image,
            rating: req.body.rating
        };

        await client.db('Cinemate').collection('movies').insertOne(newMovie);
        return res.status(200).send("Movie successfully added.");
    } catch (error) {
        console.error(error.stack);
        return res.status(500).send("Internal Server Error");
    } finally {
        client.close();
    }
});

// Update a movie:
router.put('/:id', [auth, admin], async (req, res) => {
    try {
        await client.connect();

        const movie = await client.db('Cinemate').collection('movies').findOne({ _id: new ObjectId(req.params.id) });
        if (!movie) return res.status(404).send("There is no movie with the given id.");

        const screenings = await client.db('Cinemate').collection('screenings').find({ hallId: req.params.id }).toArray();
        if (screenings.length > 0) return res.status(400).send("You cannot update this movie because there are screenings associated with it. Please remove all screenings associated with this movie first.");

        const { error } = validateMovie(req.body);
        if (error) return res.status(400).send(error.details[0].message);

        const existingMovie = await client.db('Cinemate').collection('movies').findOne({
            _id: { $not: { $eq: new ObjectId(req.params.id) } },
            title: req.body.title
        });
        if (existingMovie !== null) return res.status(400).send("This movie already exists.");

        await client.db('Cinemate').collection('movies').updateOne({ _id: new ObjectId(req.params.id) }, {
            $set: {
                title: req.body.title,
                description: req.body.description,
                genre: req.body.genre,
                director: req.body.director,
                releaseDate: req.body.releaseDate,
                duration: req.body.duration,
                image: req.body.image,
                rating: req.body.rating
            }
        });
        return res.status(200).send("Movie successfully updated.");
    } catch (error) {
        console.error(error.stack);
        return res.status(500).send("Internal Server Error");
    } finally {
        client.close();
    }
});

// Remove a movie:
router.delete('/:id', [auth, admin], async (req, res) => {
    try {
        await client.connect();

        const movie = await client.db('Cinemate').collection('movies').findOne({ _id: new ObjectId(req.params.id) });
        if (!movie) return res.status(404).send("There is no movie with the given id.");

        const screenings = await client.db('Cinemate').collection('screenings').find({ movieId: req.params.id }).toArray();
        if (screenings.length > 0) return res.status(400).send("You cannot delete this movie because there are screenings associated with it. Please remove all screenings associated with this movie first.");

        await client.db('Cinemate').collection('movies').deleteOne({ _id: new ObjectId(req.params.id) });
        const imagePath = path.join(__dirname, '../images', movie.image);
        fs.unlink(imagePath, (err) => {
            if (err) {
                console.error(`Failed to delete image: ${imagePath}`, err);
            }
        });
        return res.status(200).send("Movie successfully removed.");
    } catch (error) {
        console.error(error.stack);
        return res.status(500).send("Internal Server Error");
    } finally {
        client.close();
    }
});

module.exports = router;