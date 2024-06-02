const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

const validateReservation = require('../validation/reservationValidation');

const uri = "mongodb+srv://Admin:admin@cluster0.cv0sz3z.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// Get all reservations for a specific user
router.get('/user/:userId', auth, async (req, res) => {
    try {
        await client.connect();

        const reservations = await client.db('Cinemate').collection('reservations').aggregate([
            { $match: { userId: req.params.userId } },
            {
                $lookup: {
                    from: 'screenings',
                    let: { screeningId: { $toObjectId: '$screeningId' } },
                    pipeline: [
                        { $match: { $expr: { $eq: ['$_id', '$$screeningId'] } } }
                    ],
                    as: 'screening'
                }
            },
            { $unwind: '$screening' },
            {
                $lookup: {
                    from: 'movies',
                    let: { movieId: { $toObjectId: '$screening.movieId' } },
                    pipeline: [
                        { $match: { $expr: { $eq: ['$_id', '$$movieId'] } } }
                    ],
                    as: 'movie'
                }
            },
            { $unwind: '$movie' },
            {
                $lookup: {
                    from: 'halls',
                    let: { hallId: { $toObjectId: '$screening.hallId' } },
                    pipeline: [
                        { $match: { $expr: { $eq: ['$_id', '$$hallId'] } } }
                    ],
                    as: 'hall'
                }
            },
            { $unwind: '$hall' },
            {
                $lookup: {
                    from: 'cinemas',
                    let: { cinemaId: { $toObjectId: '$hall.cinemaId' } },
                    pipeline: [
                        { $match: { $expr: { $eq: ['$_id', '$$cinemaId'] } } }
                    ],
                    as: 'cinema'
                }
            },
            { $unwind: '$cinema' },
            {
                $project: {
                    _id: 1,
                    'screening.date': 1,
                    'screening.time': 1,
                    'movie.title': 1,
                    'hall.name': 1,
                    'cinema.name': 1
                }
            }
        ]).toArray();
        if (!reservations.length) return res.status(404).send("No reservations were found for this user.");

        return res.status(200).send(reservations);
    } catch (error) {
        console.error(error.stack);
        return res.status(500).send("Internal Server Error");
    } finally {
        await client.close();
    }
});

// Create a reservation:
router.post('/', auth, async (req, res) => {
    try {
        await client.connect();

        const { error } = validateReservation(req.body);
        if (error) return res.status(400).send(error.details[0].message);

        const existingReservation = await client.db('Cinemate').collection('reservations').findOne({
            $and: [
                { userId: req.body.userId },
                { screeningId: req.body.screeningId }
            ]
        });
        if (existingReservation !== null) return res.status(400).send("You already made a reservation for this movie.");

        const newReservation = {
            userId: req.body.userId,
            screeningId: req.body.screeningId
        };

        const screening = await client.db('Cinemate').collection('screenings').findOne({ _id: new ObjectId(req.body.screeningId) });
        if (screening.numberOfAvailableSeats === 0) return res.status(400).send("There are no available seats for this screening.");

        await client.db('Cinemate').collection('reservations').insertOne(newReservation);
        await client.db('Cinemate').collection('screenings').updateOne({ _id: new ObjectId(req.body.screeningId) }, {
            $inc: {
                numberOfAvailableSeats: -1
            }
        });
        return res.status(200).send("Reservation successfully added.");
    } catch (error) {
        console.error(error.stack);
        return res.status(500).send("Internal Server Error");
    } finally {
        client.close();
    }
});

// Remove a reservation:
router.delete('/:id', auth, async (req, res) => {
    try {
        await client.connect();

        const reservation = await client.db('Cinemate').collection('reservations').findOne({ _id: new ObjectId(req.params.id) });
        if (!reservation) return res.status(404).send("There is no reservation with the given id.");

        const screening = await client.db('Cinemate').collection('screenings').findOne({ _id: new ObjectId(reservation.screeningId) });
        const screeningDate = new Date(screening.date);
        const currentDate = new Date();
        if (Math.round((screeningDate - currentDate) / (1000 * 60 * 60 * 24)) <= 1) return res.status(400).send("You cannot cancel your reservation one day prior to the screening.");

        await client.db('Cinemate').collection('reservations').deleteOne({ _id: new ObjectId(req.params.id) });
        await client.db('Cinemate').collection('screenings').updateOne({ _id: new ObjectId(reservation.screeningId) }, {
            $inc: {
                numberOfAvailableSeats: 1
            }
        });
        return res.status(200).send("Reservation successfully removed.");
    } catch (error) {
        console.error(error.stack);
        return res.status(500).send("Internal Server Error");
    } finally {
        client.close();
    }
});

module.exports = router;