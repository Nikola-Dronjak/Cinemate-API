const { ObjectId } = require('mongodb');

const { getDb } = require('../database/db');
const { client, checkoutNodeJssdk } = require('../payment/paypalClient');
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

            var reservationsOfUser = await getDb().collection('reservations').aggregate([
                { $match: { userId: req.params.userId } },
                { $addFields: { screeningIdObj: { $toObjectId: "$screeningId" } } },
                {
                    $lookup: {
                        from: 'screenings',
                        localField: 'screeningIdObj',
                        foreignField: '_id',
                        as: 'screening'
                    }
                },
                { $unwind: '$screening' },
                { $sort: { 'screening.date': -1, 'screening.time': -1 } },
                { $project: { screening: 0, screeningIdObj: 0 } },
                { $skip: skip },
                { $limit: limit }
            ]).toArray();
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
            const { error } = validateReservation(req.body, { isCreate: true });
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

            if (screening.numberOfAvailableSeats === 0) return res.status(409).send({ message: "There are no available seats for this screening." });

            let amountValue;
            switch (req.body.currency) {
                case "EUR":
                    amountValue = screening.priceEUR.toFixed(2);
                    break;
                case "USD":
                    amountValue = screening.priceUSD.toFixed(2);
                    break;
                case "CHF":
                    amountValue = screening.priceCHF.toFixed(2);
                    break;
                default:
                    return res.status(400).send({ message: "Unsupported currency." });
            }

            const request = new checkoutNodeJssdk.orders.OrdersCreateRequest();
            request.prefer("return=representation");
            request.requestBody({
                intent: "CAPTURE",
                purchase_units: [
                    {
                        amount: {
                            currency_code: req.body.currency,
                            value: amountValue
                        }
                    }
                ],
                application_context: {
                    return_url: `${req.body.redirectUrl}`,
                    cancel_url: `${req.body.redirectUrl}`
                }
            });

            const order = await client().execute(request);
            res.status(201).send({
                orderId: order.result.id,
                approvalUrl: order.result.links.find(link => link.rel === "approve").href,
                links: [
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/reservations/${order.result.id}`, action: 'POST', types: ["application/json"] }
                ]
            });
        } catch (error) {
            console.error(error.stack);
            return res.status(500).send({ message: "Internal Server Error" });
        }
    },

    async confirmReservation(req, res) {
        try {
            const { error } = validateReservation(req.body, { isCreate: false });
            if (error) return res.status(400).send({ message: error.details[0].message });

            const request = new checkoutNodeJssdk.orders.OrdersCaptureRequest(req.params.orderId);
            request.requestBody({});
            const capture = await client().execute(request);

            if (capture.result.status !== "COMPLETED") {
                return res.status(400).send({ message: "Payment not completed." });
            }

            const newReservation = {
                userId: req.body.userId,
                screeningId: req.body.screeningId
            };

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
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: "Error confirming reservation" });
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