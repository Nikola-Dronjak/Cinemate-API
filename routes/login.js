const { MongoClient, ServerApiVersion } = require('mongodb');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const express = require('express');
const router = express.Router();

const loginValidation = require('../validation/loginValidation');

const uri = "mongodb+srv://Admin:admin@cluster0.cv0sz3z.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// Login with an existing user:
router.post('/', async (req, res) => {
    try {
        await client.connect();

        const { error } = loginValidation(req.body);
        if (error) return res.status(400).send(error.details[0].message);

        const user = await client.db('Cinemate').collection('users').findOne({ email: req.body.email });
        if (user === null) return res.status(400).send("Invalid email or password.");

        const validPassword = await bcrypt.compare(req.body.password, user.password);
        if (!validPassword) return res.status(400).send("Invalid email or password.");

        const token = jwt.sign({ userId: user._id, isAdmin: user.isAdmin }, 'jwtPrivateToken');
        res.status(200).send(token);
    } catch (error) {
        console.error(error.stack);
        return res.status(500).send("Internal Server Error");
    } finally {
        client.close();
    }
});

module.exports = router;