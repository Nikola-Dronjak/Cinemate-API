const { ObjectId } = require('mongodb');

const { getDb } = require('../database/db');
const validateCinema = require('../validation/cinemaValidation');

const cinemaController = {
    async getCinemas(req, res) {
        try {
            var cinemas = await getDb().collection('cinemas').find().toArray();
            if (cinemas.length === 0) return res.status(404).send({ message: "There are no cinemas in the database right now." });
            cinemas = cinemas.map(cinema => ({
                ...cinema,
                links: [
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/cinemas/${cinema._id}`, action: 'GET', types: [] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/cinemas/${cinema._id}`, action: 'PUT', types: ["application/json"] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/cinemas/${cinema._id}`, action: 'DELETE', types: [] }
                ]
            }));
            return res.status(200).send({
                cinemas,
                links: [
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/cinemas`, action: 'POST', types: ["application/json"] }
                ]
            });
        } catch (error) {
            console.error(error.stack);
            return res.status(500).send({ message: "Internal Server Error" });
        }
    },

    async getCinema(req, res) {
        try {
            const cinema = await getDb().collection('cinemas').findOne({ _id: new ObjectId(req.params.id) });
            if (!cinema) return res.status(404).send({ message: "There is no cinema with the given id." });
            return res.status(200).send({
                ...cinema,
                links: [
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/cinemas`, action: 'GET', types: [] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/cinemas/${cinema._id}`, action: 'GET', types: [] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/cinemas/${cinema._id}`, action: 'PUT', types: ["application/json"] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/cinemas/${cinema._id}`, action: 'DELETE', types: [] }
                ]
            });
        } catch (error) {
            console.error(error.stack);
            return res.status(500).send({ message: "Internal Server Error" });
        }
    },

    async createCinema(req, res) {
        try {
            const { error } = validateCinema(req.body);
            if (error) return res.status(400).send({ message: error.details[0].message });

            const existingCinema = await getDb().collection('cinemas').findOne({
                $and: [
                    { address: req.body.address },
                    { city: req.body.city }
                ]
            });
            if (existingCinema !== null) return res.status(409).send({ message: "There is already a cinema at this location. Please pick another location." });

            const newCinema = {
                name: req.body.name,
                address: req.body.address,
                city: req.body.city
            };

            const result = await getDb().collection('cinemas').insertOne(newCinema);
            newCinema._id = result.insertedId;
            return res.status(201).header("Location", `${req.protocol}://${req.get("host")}/api/cinemas/${newCinema._id}`).send({
                ...newCinema,
                links: [
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/cinemas`, action: 'GET', types: [] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/cinemas/${newCinema._id}`, action: 'GET', types: [] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/cinemas/${newCinema._id}`, action: 'PUT', types: ["application/json"] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/cinemas/${newCinema._id}`, action: 'DELETE', types: [] }
                ]
            });
        } catch (error) {
            console.error(error.stack);
            return res.status(500).send({ message: "Internal Server Error" });
        }
    },

    async updateCinema(req, res) {
        try {
            const cinema = await getDb().collection('cinemas').findOne({ _id: new ObjectId(req.params.id) });
            if (!cinema) return res.status(404).send({ message: "There is no cinema with the given id." });

            const { error } = validateCinema(req.body);
            if (error) return res.status(400).send({ message: error.details[0].message });

            const existingCinema = await getDb().collection('cinemas').findOne({
                _id: { $ne: new ObjectId(req.params.id) },
                $and: [
                    { address: req.body.address },
                    { city: req.body.city }
                ]
            });
            if (existingCinema !== null) return res.status(409).send({ message: "There is already a cinema at this location. Please pick another location." });

            await getDb().collection('cinemas').updateOne({ _id: new ObjectId(req.params.id) }, {
                $set: {
                    name: req.body.name,
                    address: req.body.address,
                    city: req.body.city
                }
            });
            const updatedCinema = await getDb().collection('cinemas').findOne({ _id: new ObjectId(req.params.id) });
            return res.status(200).send({
                ...updatedCinema,
                links: [
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/cinemas`, action: 'GET', types: [] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/cinemas/${updatedCinema._id}`, action: 'GET', types: [] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/cinemas/${updatedCinema._id}`, action: 'PUT', types: ["application/json"] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/cinemas/${updatedCinema._id}`, action: 'DELETE', types: [] }
                ]
            });
        } catch (error) {
            console.error(error.stack);
            return res.status(500).send({ message: "Internal Server Error" });
        }
    },

    async deleteCinema(req, res) {
        try {
            const cinema = await getDb().collection('cinemas').findOne({ _id: new ObjectId(req.params.id) });
            if (!cinema) return res.status(404).send({ message: "There is no cinema with the given id." });

            const halls = await getDb().collection('halls').find({ cinemaId: req.params.id }).toArray();
            if (halls.length > 0) return res.status(409).send({ message: "You cannot delete this cinema because there are halls associated with it. Please remove all halls associated with this cinema first." });

            await getDb().collection('cinemas').deleteOne({ _id: new ObjectId(req.params.id) });
            return res.status(204).send();
        } catch (error) {
            console.error(error.stack);
            return res.status(500).send({ message: "Internal Server Error" });
        }
    }
}

module.exports = { cinemaController };