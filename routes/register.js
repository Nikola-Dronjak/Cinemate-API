const { MongoClient, ServerApiVersion } = require('mongodb');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const express = require('express');
const router = express.Router();

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

// Register a new user:
router.post('/', async (req, res) => {
    try {
        await client.connect();

        const { error } = validateUser(req.body);
        if (error) return res.status(400).send(error.details[0].message);

        const username = await client.db('Cinemate').collection('users').findOne({ username: req.body.username });
        if (username !== null) return res.status(400).send("This username is already taken.");

        const email = await client.db('Cinemate').collection('users').findOne({ email: req.body.email });
        if (email !== null) return res.status(400).send("User already exists.");

        const salt = await bcrypt.genSalt(10);

        const newUser = {
            username: req.body.username,
            email: req.body.email,
            password: await bcrypt.hash(req.body.password, salt),
            isAdmin: false
        };

        await client.db('Cinemate').collection('users').insertOne(newUser);
        const token = jwt.sign({ userId: newUser._id, isAdmin: newUser.isAdmin }, 'jwtPrivateToken');
        res.status(200).send(token);
    } catch (error) {
        console.error(error.stack);
        return res.status(500).send("Internal Server Error");
    } finally {
        client.close();
    }
});

module.exports = router;