const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

const validateUser = require('../validation/userValidation');

const uri = "mongodb+srv://Admin:admin@cluster0.cv0sz3z.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// Get a specific user:
router.get('/:id', auth, async (req, res) => {
    try {
        await client.connect();

        const user = await client.db('Cinemate').collection('users').findOne({ _id: new ObjectId(req.params.id) }, { projection: { password: 0 } });
        if (!user) return res.status(404).send("There is no user with the given id.");
        return res.status(200).send(user);
    } catch (error) {
        console.error(error.stack);
        return res.status(500).send("Internal Server Error");
    } finally {
        client.close();
    }
});

// Update a user:
router.put('/:id', auth, async (req, res) => {
    try {
        await client.connect();

        const user = await client.db('Cinemate').collection('users').findOne({ _id: new ObjectId(req.params.id) });
        if (!user) return res.status(404).send("There is no user with the given id.");

        const { error } = validateUser(req.body);
        if (error) return res.status(400).send(error.details[0].message);

        const existingUser = await client.db('Cinemate').collection('users').findOne({
            _id: { $not: { $eq: new ObjectId(req.params.id) } },
            $and: [
                { username: req.body.username },
                { email: req.body.email }
            ]
        });
        if (existingUser !== null) return res.status(400).send("User already exists.");

        const salt = await bcrypt.genSalt(10);

        await client.db('Cinemate').collection('users').updateOne({ _id: new ObjectId(req.params.id) }, {
            $set: {
                username: req.body.username,
                email: req.body.email,
                password: await bcrypt.hash(req.body.password, salt),
            }
        });
        return res.status(200).send("User successfully updated.");
    } catch (error) {
        console.error(error.stack);
        return res.status(500).send("Internal Server Error");
    } finally {
        client.close();
    }
});

// Remove a user:
router.delete('/:id', auth, async (req, res) => {
    try {
        await client.connect();

        const user = await client.db('Cinemate').collection('users').findOne({ _id: new ObjectId(req.params.id) });
        if (!user) return res.status(404).send("There is no user with the given id.");

        await client.db('Cinemate').collection('reservations').deleteMany({ userId: req.params.id });

        await client.db('Cinemate').collection('users').deleteOne({ _id: new ObjectId(req.params.id) });
        return res.status(200).send("User successfully removed.");
    } catch (error) {
        console.error(error.stack);
        return res.status(500).send("Internal Server Error");
    } finally {
        client.close();
    }
});

module.exports = router;