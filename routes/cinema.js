const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

const validateCinema = require('../validation/cinemaValidation');

const uri = "mongodb+srv://Admin:admin@cluster0.cv0sz3z.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// Get all cinemas:
router.get('/', [auth, admin], async (req, res) => {
    try {
        await client.connect();

        const cinemas = await client.db('Cinemate').collection('cinemas').find().toArray();
        if (cinemas.length === 0) return res.status(404).send("There are no cinemas in the database right now.");
        return res.status(200).send(cinemas);
    } catch (error) {
        console.error(error.stack);
        return res.status(500).send("Internal Server Error");
    } finally {
        client.close();
    }
});

// Get a specific cinema:
router.get('/:id', async (req, res) => {
    try {
        await client.connect();

        const cinema = await client.db('Cinemate').collection('cinemas').findOne({ _id: new ObjectId(req.params.id) });
        if (!cinema) return res.status(404).send("There is no cinema with the given id.");
        return res.status(200).send(cinema);
    } catch (error) {
        console.error(error.stack);
        return res.status(500).send("Internal Server Error");
    } finally {
        client.close();
    }
});

// Create a cinema:
router.post('/', [auth, admin], async (req, res) => {
    try {
        await client.connect();

        const { error } = validateCinema(req.body);
        if (error) return res.status(400).send(error.details[0].message);

        const existingCinema = await client.db('Cinemate').collection('cinemas').findOne({
            $and: [
                { address: req.body.address },
                { city: req.body.city }
            ]
        });
        if (existingCinema !== null) return res.status(400).send("There is already a cinema at this location. Please pick another location.");

        const newCinema = {
            name: req.body.name,
            address: req.body.address,
            city: req.body.city
        };

        await client.db('Cinemate').collection('cinemas').insertOne(newCinema);
        return res.status(200).send("Cinema successfully added.");
    } catch (error) {
        console.error(error.stack);
        return res.status(500).send("Internal Server Error");
    } finally {
        client.close();
    }
});

// Update a cinema:
router.put('/:id', [auth, admin], async (req, res) => {
    try {
        await client.connect();

        const cinema = await client.db('Cinemate').collection('cinemas').findOne({ _id: new ObjectId(req.params.id) });
        if (!cinema) return res.status(404).send("There is no cinema with the given id.");

        const { error } = validateCinema(req.body);
        if (error) return res.status(400).send(error.details[0].message);

        const existingCinema = await client.db('Cinemate').collection('cinemas').findOne({
            _id: { $not: { $eq: new ObjectId(req.params.id) } },
            $and: [
                { address: req.body.address },
                { city: req.body.city }
            ]
        });
        if (existingCinema !== null) return res.status(400).send("There is already a cinema at this location. Please pick another location.");

        await client.db('Cinemate').collection('cinemas').updateOne({ _id: new ObjectId(req.params.id) }, {
            $set: {
                name: req.body.name,
                address: req.body.address,
                city: req.body.city
            }
        });
        return res.status(200).send("Cinema successfully updated.");
    } catch (error) {
        console.error(error.stack);
        return res.status(500).send("Internal Server Error");
    } finally {
        client.close();
    }
});

// Remove a cinema:
router.delete('/:id', [auth, admin], async (req, res) => {
    try {
        await client.connect();

        const cinema = await client.db('Cinemate').collection('cinemas').findOne({ _id: new ObjectId(req.params.id) });
        if (!cinema) return res.status(404).send("There is no cinema with the given id.");

        const halls = await client.db('Cinemate').collection('halls').find({ cinemaId: req.params.id }).toArray();
        if (halls.length > 0) return res.status(400).send("You cannot delete this cinema because there are halls associated with it. Please remove all halls associated with this cinema first.");

        await client.db('Cinemate').collection('cinemas').deleteOne({ _id: new ObjectId(req.params.id) });
        return res.status(200).send("Cinema successfully removed.");
    } catch (error) {
        console.error(error.stack);
        return res.status(500).send("Internal Server Error");
    } finally {
        client.close();
    }
});

module.exports = router;