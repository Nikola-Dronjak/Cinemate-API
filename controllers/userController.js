const { ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const { getDb } = require('../database/db');
const validateUser = require('../validation/userValidation');
const loginValidation = require('../validation/loginValidation');

const userController = {
    async getUser(req, res) {
        try {
            const user = await getDb().collection('users').findOne({ _id: new ObjectId(req.params.id) }, { projection: { password: 0, isAdmin: 0 } });
            if (!user) return res.status(404).send({ message: "There is no user with the given id." });
            return res.status(200).send({
                ...user,
                links: [
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/users/${user._id}`, action: 'GET', types: [] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/users/register`, action: 'POST', types: ["multipart/form-data"] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/users/login`, action: 'POST', types: ["multipart/form-data"] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/users/${user._id}`, action: 'PUT', types: ["multipart/form-data"] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/users/${user._id}`, action: 'DELETE', types: [] }
                ]
            });
        } catch (error) {
            console.error(error.stack);
            return res.status(500).send({ message: "Internal Server Error" });
        }
    },

    async registerUser(req, res) {
        try {
            const { error } = validateUser(req.body, { isUpdate: false });
            if (error) return res.status(400).send({ message: error.details[0].message });

            const username = await getDb().collection('users').findOne({ username: req.body.username });
            if (username !== null) return res.status(409).send({ message: "This username is already taken." });

            const email = await getDb().collection('users').findOne({ email: req.body.email });
            if (email !== null) return res.status(409).send({ message: "User already exists." });

            const salt = await bcrypt.genSalt(10);

            const newUser = {
                username: req.body.username,
                email: req.body.email,
                password: await bcrypt.hash(req.body.password, salt),
                isAdmin: false,
                profilePicture: null
            };

            const result = await getDb().collection('users').insertOne(newUser);
            newUser._id = result.insertedId;
            const token = jwt.sign({ userId: newUser._id, isAdmin: newUser.isAdmin }, 'jwtPrivateToken', { expiresIn: '1h' });
            res.status(201).header("Location", `${req.protocol}://${req.get("host")}/api/users/${newUser._id}`).send({
                token,
                user: {
                    _id: newUser._id,
                    username: newUser.username,
                    email: newUser.email,
                    profilePicture: newUser.profilePicture
                },
                links: [
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/users/${newUser._id}`, action: 'GET', types: [] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/users/${newUser._id}`, action: 'PUT', types: ["multipart/form-data"] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/users/${newUser._id}`, action: 'DELETE', types: [] }
                ]
            });
        } catch (error) {
            console.error(error.stack);
            return res.status(500).send({ message: "Internal Server Error" });
        }
    },

    async loginUser(req, res) {
        try {
            const { error } = loginValidation(req.body);
            if (error) return res.status(400).send({ message: error.details[0].message });

            const user = await getDb().collection('users').findOne({ email: req.body.email });
            if (user === null) return res.status(401).send({ message: "Invalid email or password." });

            const validPassword = await bcrypt.compare(req.body.password, user.password);
            if (!validPassword) return res.status(401).send({ message: "Invalid email or password." });

            const token = jwt.sign({ userId: user._id, isAdmin: user.isAdmin }, 'jwtPrivateToken', { expiresIn: '1h' });
            res.status(200).send(token);
        } catch (error) {
            console.error(error.stack);
            return res.status(500).send({ message: "Internal Server Error" });
        }
    },

    async updateUser(req, res) {
        try {
            const user = await getDb().collection('users').findOne({ _id: new ObjectId(req.params.id) });
            if (!user) return res.status(404).send({ message: "There is no user with the given id." });

            const { error } = validateUser(req.body, { isUpdate: true });
            if (error) return res.status(400).send({ message: error.details[0].message });

            const existingUser = await getDb().collection('users').findOne({
                _id: { $not: { $eq: new ObjectId(req.params.id) } },
                $and: [
                    { username: req.body.username },
                    { email: req.body.email }
                ]
            });
            if (existingUser !== null) return res.status(409).send({ message: "User already exists." });

            const salt = await bcrypt.genSalt(10);

            var updatedUser = {
                username: req.body.username,
                email: req.body.email,
                ...(req.body.password ? { password: await bcrypt.hash(req.body.password, salt) } : {})
            };

            if (req.file) {
                if (user.profilePicture) {
                    const oldImagePath = path.join(__dirname, '../images', user.profilePicture);
                    fs.unlink(oldImagePath, (err) => {
                        if (err) console.error(`Failed to delete old image: ${oldImagePath}`, err);
                    });
                }
                updatedUser.profilePicture = req.file.filename;
            }

            await getDb().collection('users').updateOne({ _id: new ObjectId(req.params.id) }, { $set: updatedUser });
            updatedUser = await getDb().collection('users').findOne({ _id: new ObjectId(req.params.id) }, { projection: { password: 0, isAdmin: 0 } });
            return res.status(200).send({
                ...updatedUser,
                links: [
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/users/${user._id}`, action: 'GET', types: [] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/users/${user._id}`, action: 'PUT', types: ["multipart/form-data"] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/users/${user._id}`, action: 'DELETE', types: [] }
                ]
            });
        } catch (error) {
            console.error(error.stack);
            return res.status(500).send({ message: "Internal Server Error" });
        }
    },

    async deleteUser(req, res) {
        try {
            const user = await getDb().collection('users').findOne({ _id: new ObjectId(req.params.id) });
            if (!user) return res.status(404).send({ message: "There is no user with the given id." });

            await getDb().collection('reservations').deleteMany({ userId: req.params.id });

            await getDb().collection('users').deleteOne({ _id: new ObjectId(req.params.id) });
            const imagePath = path.join(__dirname, '../images', user.profilePicture);
            fs.unlink(imagePath, (err) => {
                if (err) {
                    console.error(`Failed to delete image: ${imagePath}`, err);
                }
            });
            return res.status(204).send();
        } catch (error) {
            console.error(error.stack);
            return res.status(500).send({ message: "Internal Server Error" });
        }
    }
}

module.exports = { userController };