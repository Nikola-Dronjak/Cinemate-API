const { ObjectId } = require('mongodb');

const { getDb } = require('../database/db');
const validatePagination = require('../validation/paginationValidation');
const validateReservation = require('../validation/reservationValidation');

const reservationController = {
    async getReservationsOfUser(req, res) {
        try {
            const { error, value } = validatePagination(req.query);
            if (error) return res.status(400).send({ message: error.details[0].message });

            const { page, limit } = value;
            const skip = (page - 1) * limit;

            const totalReservations = await getDb().collection('reservations').countDocuments({ userId: req.params.userId });
            const totalPages = Math.ceil(totalReservations / limit);

            const user = await getDb().collection('users').findOne({ _id: new ObjectId(req.params.userId) });
            if (!user) return res.status(404).send({ message: "There is no user with the given userId." });

            var reservationsOfUser = await getDb().collection('reservations').find({ userId: req.params.userId }).skip(skip).limit(limit).toArray();
            if (!reservationsOfUser.length) return res.status(404).send({ message: "No reservations were found for this user." });
            reservationsOfUser = reservationsOfUser.map(reservation => ({
                ...reservation,
                links: [
                    { rel: 'screening', href: `${req.protocol}://${req.get("host")}/api/screenings/${reservation.screeningId}`, action: 'GET', types: [] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/reservations/${reservation._id}`, action: 'DELETE', types: [] }
                ]
            }));
            return res.status(200).send({
                page,
                limit,
                totalPages,
                totalReservations,
                reservationsOfUser,
                links: [
                    { rel: 'user', href: `${req.protocol}://${req.get("host")}/api/users/${user._id}`, action: 'GET', types: [] },
                    ...(page > 1 ? [{ rel: 'prev', href: `${req.protocol}://${req.get("host")}/api/users/${user._id}/reservations?page=${page - 1}&limit=${limit}`, action: 'GET', types: [] }] : []),
                    ...(page < totalPages ? [{ rel: 'next', href: `${req.protocol}://${req.get("host")}/api/users/${user._id}/reservations?page=${page + 1}&limit=${limit}`, action: 'GET', types: [] }] : []),
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/users/${user._id}/reservations?page=${page}&limit=${limit}`, action: 'GET', types: [] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/reservations`, action: 'POST', types: ["application/json"] }
                ]
            });
        } catch (error) {
            console.error(error.stack);
            return res.status(500).send({ message: "Internal Server Error" });
        }
    },

    async createReservation(req, res) {
        try {
            const { error } = validateReservation(req.body);
            if (error) return res.status(400).send({ message: error.details[0].message });

            const user = await getDb().collection('users').findOne({ _id: new ObjectId(req.body.userId) });
            if (!user) return res.status(404).send({ message: "There is no user with the given userId." });

            const screening = await getDb().collection('screenings').findOne({ _id: new ObjectId(req.body.screeningId) });
            if (!screening) return res.status(404).send({ message: "There is no screening with the given screeningId." });

            const existingReservation = await getDb().collection('reservations').findOne({
                $and: [
                    { userId: req.body.userId },
                    { screeningId: req.body.screeningId }
                ]
            });
            if (existingReservation !== null) return res.status(409).send({ message: "You already made a reservation for this movie." });

            const newReservation = {
                userId: req.body.userId,
                screeningId: req.body.screeningId
            };

            if (screening.numberOfAvailableSeats === 0) return res.status(409).send({ message: "There are no available seats for this screening." });

            const result = await getDb().collection('reservations').insertOne(newReservation);
            newReservation._id = result.insertedId;
            await getDb().collection('screenings').updateOne({ _id: new ObjectId(req.body.screeningId) }, {
                $inc: {
                    numberOfAvailableSeats: -1
                }
            });
            return res.status(201).header("Location", `${req.protocol}://${req.get("host")}/api/users/${newReservation.userId}/reservations`).send({
                ...newReservation,
                links: [
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/users/${newReservation.userId}/reservations`, action: 'GET', types: [] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/reservations/${newReservation._id}`, action: 'DELETE', types: [] }
                ]
            });
        } catch (error) {
            console.error(error.stack);
            return res.status(500).send({ message: "Internal Server Error" });
        }
    },

    async deleteReservation(req, res) {
        try {
            const reservation = await getDb().collection('reservations').findOne({ _id: new ObjectId(req.params.id) });
            if (!reservation) return res.status(404).send({ message: "There is no reservation with the given id." });

            const screening = await getDb().collection('screenings').findOne({ _id: new ObjectId(reservation.screeningId) });
            const screeningDate = new Date(screening.date);
            const currentDate = new Date();
            if (Math.round((screeningDate - currentDate) / (1000 * 60 * 60 * 24)) <= 1) return res.status(409).send({ message: "You cannot cancel your reservation one day prior to the screening." });

            await getDb().collection('reservations').deleteOne({ _id: new ObjectId(req.params.id) });
            await getDb().collection('screenings').updateOne({ _id: new ObjectId(reservation.screeningId) }, {
                $inc: {
                    numberOfAvailableSeats: 1
                }
            });
            return res.status(204).send();
        } catch (error) {
            console.error(error.stack);
            return res.status(500).send({ message: "Internal Server Error" });
        }
    }
}

module.exports = { reservationController };