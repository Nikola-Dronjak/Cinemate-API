const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

const validateHall = require('../validation/hallValidation');

const uri = "mongodb+srv://Admin:admin@cluster0.cv0sz3z.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// Get all halls for a specific cinema:
router.get('/cinema/:cinemaId', [auth, admin], async (req, res) => {
    try {
        await client.connect();

        const cinema = await client.db('Cinemate').collection('cinemas').findOne({ _id: new ObjectId(req.params.cinemaId) });
        if (!cinema) return res.status(404).send("There is no cinema with the given id.");

        const halls = await client.db('Cinemate').collection('halls').find({ cinemaId: req.params.cinemaId }).toArray();
        if (halls.length === 0) return res.status(404).send("This cinema doesnt have any halls right now.");
        return res.status(200).send({ halls, cinema });
    } catch (error) {
        console.error(error.stack);
        return res.status(500).send("Internal Server Error");
    } finally {
        client.close();
    }
});

// Get hall details along with its screenings and movie titles
router.get('/:id', async (req, res) => {
    try {
        await client.connect();

        const hall = await client.db('Cinemate').collection('halls').findOne({ _id: new ObjectId(req.params.id) });
        if (!hall) return res.status(404).send("There is no hall with the given id.");

        const cinema = await client.db('Cinemate').collection('cinemas').findOne({ _id: new ObjectId(hall.cinemaId) });
        if (!cinema) return res.status(404).send("There is no cinema with the given cinemaId.");

        const screenings = await client.db('Cinemate').collection('screenings').find({ hallId: req.params.id }).toArray();

        const screeningsWithMovieTitles = await Promise.all(screenings.map(async (screening) => {
            const movie = await client.db('Cinemate').collection('movies').findOne({ _id: new ObjectId(screening.movieId) });
            return {
                ...screening,
                movieTitle: movie ? movie.title : 'Unknown'
            };
        }));

        return res.status(200).send({ hall, cinema, screenings: screeningsWithMovieTitles });
    } catch (error) {
        console.error(error.stack);
        return res.status(500).send("Internal Server Error");
    } finally {
        await client.close();
    }
});

// Create a hall:
router.post('/', [auth, admin], async (req, res) => {
    try {
        await client.connect();

        const { error } = validateHall(req.body);
        if (error) return res.status(400).send(error.details[0].message);

        const existingHall = await client.db('Cinemate').collection('halls').findOne({
            $and: [
                { name: req.body.name },
                { cinemaId: req.body.cinemaId }
            ]
        });
        if (existingHall !== null) return res.status(400).send("This hall already exists.");

        const newHall = {
            name: req.body.name,
            numberOfSeats: req.body.numberOfSeats,
            cinemaId: req.body.cinemaId
        };

        await client.db('Cinemate').collection('halls').insertOne(newHall);
        return res.status(200).send("Hall successfully added.");
    } catch (error) {
        console.error(error.stack);
        return res.status(500).send("Internal Server Error");
    } finally {
        client.close();
    }
});

// Update a hall:
router.put('/:id', [auth, admin], async (req, res) => {
    try {
        await client.connect();

        const hall = await client.db('Cinemate').collection('halls').findOne({ _id: new ObjectId(req.params.id) });
        if (!hall) return res.status(404).send("There is no hall with the given id.");

        const screenings = await client.db('Cinemate').collection('screenings').find({ hallId: req.params.id }).toArray();
        if (screenings.length > 0) return res.status(400).send("You cannot update this hall because there are screenings associated with it. Please remove all screenings associated with this hall first.");

        const { error } = validateHall(req.body);
        if (error) return res.status(400).send(error.details[0].message);

        const existingHall = await client.db('Cinemate').collection('halls').findOne({
            _id: { $not: { $eq: new ObjectId(req.params.id) } },
            $and: [
                { name: req.body.name },
                { cinemaId: req.body.cinemaId }
            ]
        });
        if (existingHall !== null) return res.status(400).send("This hall already exists.");

        await client.db('Cinemate').collection('halls').updateOne({ _id: new ObjectId(req.params.id) }, {
            $set: {
                name: req.body.name,
                numberOfSeats: req.body.numberOfSeats,
                cinemaId: req.body.cinemaId
            }
        });
        return res.status(200).send("Hall successfully updated.");
    } catch (error) {
        console.error(error.stack);
        return res.status(500).send("Internal Server Error");
    } finally {
        client.close();
    }
});

// Remove a hall:
router.delete('/:id', [auth, admin], async (req, res) => {
    try {
        await client.connect();

        const hall = await client.db('Cinemate').collection('halls').findOne({ _id: new ObjectId(req.params.id) });
        if (!hall) return res.status(404).send("There is no hall with the given id.");

        const screenings = await client.db('Cinemate').collection('screenings').find({ hallId: req.params.id }).toArray();
        if (screenings.length > 0) return res.status(400).send("You cannot delete this hall because there are screenings associated with it. Please remove all screenings associated with this hall first.");

        await client.db('Cinemate').collection('halls').deleteOne({ _id: new ObjectId(req.params.id) });
        return res.status(200).send("Hall successfully removed.");
    } catch (error) {
        console.error(error.stack);
        return res.status(500).send("Internal Server Error");
    } finally {
        client.close();
    }
});

module.exports = router;