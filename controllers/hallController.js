const { ObjectId } = require('mongodb');

const { getDb } = require('../database/db');
const validateHall = require('../validation/hallValidation');

const hallController = {
    async getHallsOfCinema(req, res) {
        try {
            const cinema = await getDb().collection('cinemas').findOne({ _id: new ObjectId(req.params.cinemaId) });
            if (!cinema) return res.status(404).send({ message: "There is no cinema with the given id." });

            var halls = await getDb().collection('halls').find({ cinemaId: req.params.cinemaId }).toArray();
            if (halls.length === 0) return res.status(404).send({ message: "This cinema doesnt have any halls right now." });
            halls = halls.map(hall => ({
                ...hall,
                links: [
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/halls/${hall._id}`, action: 'GET', types: [] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/halls/${hall._id}`, action: 'PUT', types: ["application/json"] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/halls/${hall._id}`, action: 'DELETE', types: [] }
                ]
            }));
            return res.status(200).send({
                halls,
                links: [
                    { rel: 'cinema', href: `${req.protocol}://${req.get("host")}/api/cinemas/${cinema._id}`, action: 'GET', types: [] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/halls`, action: 'POST', types: ["application/json"] }
                ]
            });
        } catch (error) {
            console.error(error.stack);
            return res.status(500).send({ message: "Internal Server Error" });
        }
    },

    async getHall(req, res) {
        try {
            const hall = await getDb().collection('halls').findOne({ _id: new ObjectId(req.params.id) });
            if (!hall) return res.status(404).send({ message: "There is no hall with the given id." });

            return res.status(200).send({
                ...hall,
                links: [
                    { rel: 'cinema', href: `${req.protocol}://${req.get("host")}/api/cinemas/${hall.cinemaId}`, action: 'GET', types: [] },
                    { rel: 'screening', href: `${req.protocol}://${req.get("host")}/api/halls/${hall._id}/screenings`, action: 'GET', types: [] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/cinemas/${hall.cinemaId}/halls`, action: 'GET', types: [] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/halls/${hall._id}`, action: 'GET', types: [] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/halls/${hall._id}`, action: 'PUT', types: ["application/json"] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/halls/${hall._id}`, action: 'DELETE', types: [] }
                ]
            });
        } catch (error) {
            console.error(error.stack);
            return res.status(500).send({ message: "Internal Server Error" });
        }
    },

    async createHall(req, res) {
        try {
            const { error } = validateHall(req.body);
            if (error) return res.status(400).send({ message: error.details[0].message });

            const cinema = await getDb().collection('cinemas').findOne({ _id: new ObjectId(req.body.cinemaId) });
            if (!cinema) return res.status(404).send({ message: "There is no cinema with the given cinemaId." });

            const existingHall = await getDb().collection('halls').findOne({
                $and: [
                    { name: req.body.name },
                    { cinemaId: req.body.cinemaId }
                ]
            });
            if (existingHall !== null) return res.status(409).send({ message: "This hall already exists." });

            const newHall = {
                name: req.body.name,
                numberOfSeats: req.body.numberOfSeats,
                cinemaId: req.body.cinemaId
            };

            const result = await getDb().collection('halls').insertOne(newHall);
            newHall._id = result.insertedId;
            return res.status(201).header("Location", `${req.protocol}://${req.get("host")}/api/halls/${newHall._id}`).send({
                ...newHall,
                links: [
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/cinemas/${newHall.cinemaId}/halls`, action: 'GET', types: [] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/halls/${newHall._id}`, action: 'GET', types: [] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/halls/${newHall._id}`, action: 'PUT', types: ["application/json"] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/halls/${newHall._id}`, action: 'DELETE', types: [] }
                ]
            });
        } catch (error) {
            console.error(error.stack);
            return res.status(500).send({ message: "Internal Server Error" });
        }
    },

    async updateHall(req, res) {
        try {
            const hall = await getDb().collection('halls').findOne({ _id: new ObjectId(req.params.id) });
            if (!hall) return res.status(404).send({ message: "There is no hall with the given id." });

            const { error } = validateHall(req.body);
            if (error) return res.status(400).send({ message: error.details[0].message });

            const cinema = await getDb().collection('cinemas').findOne({ _id: new ObjectId(req.body.cinemaId) });
            if (!cinema) return res.status(404).send({ message: "There is no cinema with the given cinemaId." });

            const screenings = await getDb().collection('screenings').find({ hallId: req.params.id }).toArray();
            if (screenings.length > 0) return res.status(409).send({ message: "You cannot update this hall because there are screenings associated with it. Please remove all screenings associated with this hall first." });

            const existingHall = await getDb().collection('halls').findOne({
                _id: { $ne: new ObjectId(req.params.id) },
                $and: [
                    { name: req.body.name },
                    { cinemaId: req.body.cinemaId }
                ]
            });
            if (existingHall !== null) return res.status(409).send({ message: "This hall already exists." });

            await getDb().collection('halls').updateOne({ _id: new ObjectId(req.params.id) }, {
                $set: {
                    name: req.body.name,
                    numberOfSeats: req.body.numberOfSeats,
                    cinemaId: req.body.cinemaId
                }
            });
            const updatedHall = await getDb().collection('halls').findOne({ _id: new ObjectId(req.params.id) });
            return res.status(200).send({
                ...updatedHall,
                links: [
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/cinemas/${updatedHall.cinemaId}/halls`, action: 'GET', types: [] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/halls/${updatedHall._id}`, action: 'GET', types: [] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/halls/${updatedHall._id}`, action: 'PUT', types: ["application/json"] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/halls/${updatedHall._id}`, action: 'DELETE', types: [] }
                ]
            });
        } catch (error) {
            console.error(error.stack);
            return res.status(500).send({ message: "Internal Server Error" });
        }
    },

    async deleteHall(req, res) {
        try {
            const hall = await getDb().collection('halls').findOne({ _id: new ObjectId(req.params.id) });
            if (!hall) return res.status(404).send({ message: "There is no hall with the given id." });

            const screenings = await getDb().collection('screenings').find({ hallId: req.params.id }).toArray();
            if (screenings.length > 0) return res.status(409).send({ message: "You cannot delete this hall because there are screenings associated with it. Please remove all screenings associated with this hall first." });

            await getDb().collection('halls').deleteOne({ _id: new ObjectId(req.params.id) });
            return res.status(204).send();
        } catch (error) {
            console.error(error.stack);
            return res.status(500).send({ message: "Internal Server Error" });
        }
    }
}

module.exports = { hallController };