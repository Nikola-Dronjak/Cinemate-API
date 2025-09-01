const { ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const { getDb } = require('../database/db');
const validatePagination = require('../validation/paginationValidation');
const validateUser = require('../validation/userValidation');

const loginValidation = require('../validation/loginValidation');

const userController = {
    async getUsers(req, res) {
        try {
            const { error, value } = validatePagination(req.query);
            if (error) return res.status(400).send({ message: error.details[0].message });

            const { page, limit } = value;
            const skip = (page - 1) * limit;

            const totalUsers = await getDb().collection('users').countDocuments();
            const totalPages = Math.ceil(totalUsers / limit);

            var users = await getDb().collection('users').find({}, { projection: { password: 0, refreshToken: 0 } }).skip(skip).limit(limit).toArray();
            if (users.length === 0) return res.status(404).send({ message: "There are no users in the database right now." });
            users = users.map(user => ({
                ...user,
                links: [
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/user/${user._id}/role`, action: 'PATCH', types: ["application/json"] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/user/${user._id}`, action: 'DELETE', types: [] }
                ]
            }));
            return res.status(200).send({
                page,
                limit,
                totalPages,
                totalUsers,
                users,
                links: [
                    ...(page > 1 ? [{ rel: 'prev', href: `${req.protocol}://${req.get("host")}/api/users?page=${page - 1}&limit=${limit}`, action: 'GET', types: [] }] : []),
                    ...(page < totalPages ? [{ rel: 'next', href: `${req.protocol}://${req.get("host")}/api/users?page=${page + 1}&limit=${limit}`, action: 'GET', types: [] }] : []),
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/users?page=${page}&limit=${limit}`, action: 'GET', types: [] }
                ]
            });
        } catch (error) {
            console.error(error.stack);
            return res.status(500).send({ message: "Internal Server Error" });
        }
    },

    async getUser(req, res) {
        try {
            if (req.user.userId !== req.params.id) return res.status(403).send({ message: "You are not authorized to perform this action." });

            const user = await getDb().collection('users').findOne({ _id: new ObjectId(req.params.id) }, { projection: { password: 0, role: 0, refreshToken: 0 } });
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
            const { error } = validateUser(req.body, { isUpdate: false, changedRole: false });
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
                role: "Customer",
                profilePicture: null
            };

            const result = await getDb().collection('users').insertOne(newUser);
            newUser._id = result.insertedId;

            const accessToken = jwt.sign({ userId: newUser._id, role: newUser.role }, 'jwtPrivateToken', { expiresIn: '15m' });
            const refreshToken = jwt.sign({ userId: newUser._id }, 'jwtPrivateToken', { expiresIn: '7d' });

            await getDb().collection('users').updateOne({ _id: newUser._id }, { $set: { refreshToken } })

            res.status(201).header("Location", `${req.protocol}://${req.get("host")}/api/users/${newUser._id}`).send({
                accessToken: accessToken,
                refreshToken: refreshToken,
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

            const accessToken = jwt.sign({ userId: user._id, role: user.role }, 'jwtPrivateToken', { expiresIn: '15m' });
            const refreshToken = jwt.sign({ userId: user._id }, 'jwtPrivateToken', { expiresIn: '7d' });

            await getDb().collection('users').updateOne({ _id: user._id }, { $set: { refreshToken } })

            res.status(200).send({
                accessToken: accessToken,
                refreshToken: refreshToken
            });
        } catch (error) {
            console.error(error.stack);
            return res.status(500).send({ message: "Internal Server Error" });
        }
    },

    async logoutUser(req, res) {
        try {
            if (req.user.userId !== req.body.userId) return res.status(403).send({ message: "You are not authorized to perform this action." });

            await getDb().collection('users').updateOne({ _id: new ObjectId(req.body.userId) }, { $set: { refreshToken: null } });
            return res.status(200).send({ message: "Logged out successfully." });
        } catch (error) {
            console.error(error.stack);
            return res.status(500).send({ message: "Internal Server Error" });
        }
    },

    async refreshAccessToken(req, res) {
        try {
            const token = req.body.refreshToken;
            if (!token) return res.status(401).send({ message: 'No refresh token provided.' });

            const decoded = jwt.verify(token, 'jwtPrivateToken');
            const user = await getDb().collection('users').findOne({ _id: new ObjectId(decoded.userId) });

            if (!user || user.refreshToken !== token)
                return res.status(403).send({ message: 'Invalid refresh token.' });

            const newAccessToken = jwt.sign({ userId: user._id, role: user.role }, 'jwtPrivateToken', { expiresIn: '15m' });

            res.status(200).send({
                accessToken: newAccessToken
            });
        } catch (error) {
            console.error(error.stack);
            return res.status(403).send({ message: 'Refresh token expired or invalid.' });
        }
    },

    async updateUser(req, res) {
        try {
            if (req.user.userId !== req.params.id) return res.status(403).send({ message: "You are not authorized to perform this action." });

            const user = await getDb().collection('users').findOne({ _id: new ObjectId(req.params.id) });
            if (!user) return res.status(404).send({ message: "There is no user with the given id." });

            const { error } = validateUser(req.body, { isUpdate: true, changedRole: false });
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
            updatedUser = await getDb().collection('users').findOne({ _id: new ObjectId(req.params.id) }, { projection: { password: 0, role: 0, refreshToken: 0 } });
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

    async changeUserRole(req, res) {
        try {
            const user = await getDb().collection('users').findOne({ _id: new ObjectId(req.params.id) });
            if (!user) return res.status(404).send({ message: "There is no user with the given id." });

            const { error } = validateUser(req.body, { isUpdate: false, changedRole: true });
            if (error) return res.status(400).send({ message: error.details[0].message });

            await getDb().collection('users').updateOne({ _id: new ObjectId(req.params.id) }, { $set: { role: req.body.role } });
            const updatedUser = await getDb().collection('users').findOne({ _id: new ObjectId(req.params.id) }, { projection: { password: 0, refreshToken: 0 } });
            return res.status(200).send({
                ...updatedUser,
                links: [
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/users/${user._id}`, action: 'GET', types: [] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/user/${user._id}/role`, action: 'PATCH', types: ["application/json"] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/user/${user._id}`, action: 'DELETE', types: [] }
                ]
            });
        } catch (error) {
            console.error(error.stack);
            return res.status(500).send({ message: "Internal Server Error" });
        }
    },

    async deleteUser(req, res) {
        try {
            if (req.user.role !== 'Admin' && req.user.userId !== req.params.id) return res.status(403).send({ message: "You are not authorized to perform this action." });

            const user = await getDb().collection('users').findOne({ _id: new ObjectId(req.params.id) });
            if (!user) return res.status(404).send({ message: "There is no user with the given id." });

            await getDb().collection('reservations').deleteMany({ userId: req.params.id });

            await getDb().collection('users').deleteOne({ _id: new ObjectId(req.params.id) });
            if (user.profilePicture) {
                const oldImagePath = path.join(__dirname, '../images', user.profilePicture);
                fs.unlink(oldImagePath, (err) => {
                    if (err) console.error(`Failed to delete old image: ${oldImagePath}`, err);
                });
            }
            return res.status(204).send();
        } catch (error) {
            console.error(error.stack);
            return res.status(500).send({ message: "Internal Server Error" });
        }
    }
}

module.exports = { userController };