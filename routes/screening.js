const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

const validateScreening = require('../validation/screeningValidation');

const uri = "mongodb+srv://Admin:admin@cluster0.cv0sz3z.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// Get necessary data for adding a screening:
router.get('/', [auth, admin], async (req, res) => {
    try {
        await client.connect();
        const { movieId, hallId, cinemaId } = req.query;

        let screeningData = {
            cinemas: [],
            movies: [],
            halls: []
        };

        if (movieId) {
            const movie = await client.db('Cinemate').collection('movies').findOne({ _id: new ObjectId(movieId) });
            if (!movie) return res.status(404).send("Movie not found.");
            screeningData.movie = movie;

            const cinemas = await client.db('Cinemate').collection('cinemas').find().toArray();
            screeningData.cinemas = cinemas;

            if (cinemaId) {
                const halls = await client.db('Cinemate').collection('halls').find({ cinemaId: cinemaId }).toArray();
                screeningData.halls = halls;
            }
        } else if (hallId) {
            const hall = await client.db('Cinemate').collection('halls').findOne({ _id: new ObjectId(hallId) });
            if (!hall) return res.status(404).send("Hall not found.");
            screeningData.hall = hall;

            const movies = await client.db('Cinemate').collection('movies').find().toArray();
            screeningData.movies = movies;
        }

        return res.status(200).send(screeningData);
    } catch (error) {
        console.error(error.stack);
        return res.status(500).send("Internal Server Error");
    } finally {
        await client.close();
    }
});

// Get a specific screening:
router.get('/:id', async (req, res) => {
    try {
        await client.connect();

        const screening = await client.db('Cinemate').collection('screenings').findOne({ _id: new ObjectId(req.params.id) });
        if (!screening) return res.status(404).send("Screening not found.");

        const movie = await client.db('Cinemate').collection('movies').findOne({ _id: new ObjectId(screening.movieId) });
        if (!movie) return res.status(404).send("Movie not found.");

        const hall = await client.db('Cinemate').collection('halls').findOne({ _id: new ObjectId(screening.hallId) });
        if (!hall) return res.status(404).send("Hall not found.");

        const cinema = await client.db('Cinemate').collection('cinemas').findOne({ _id: new ObjectId(hall.cinemaId) });
        if (!cinema) return res.status(404).send("Cinema not found.");

        const halls = await client.db('Cinemate').collection('halls').aggregate([
            { $match: { cinemaId: cinema._id.toString() } },
            {
                $lookup: {
                    from: 'cinemas',
                    let: { cinemaId: { $toObjectId: '$cinemaId' } },
                    pipeline: [
                        { $match: { $expr: { $eq: ['$_id', '$$cinemaId'] } } }
                    ],
                    as: 'cinema'
                }
            },
            { $unwind: '$cinema' }
        ]).toArray();

        const cinemas = await client.db('Cinemate').collection('cinemas').find().toArray();
        const movies = await client.db('Cinemate').collection('movies').find().toArray();

        const screeningData = {
            screening,
            movie,
            hall,
            cinema,
            cinemas,
            halls,
            movies
        };

        return res.status(200).send(screeningData);
    } catch (error) {
        console.error(error.stack);
        return res.status(500).send("Internal Server Error");
    } finally {
        await client.close();
    }
});

// Create a screening:
router.post('/', [auth, admin], async (req, res) => {
    try {
        await client.connect();

        // Check if the body of the request is valid:
        const { error } = validateScreening(req.body);
        if (error) return res.status(400).send(error.details[0].message);

        // Date validation:
        if (new Date(req.body.date) < new Date()) {
            return res.status(400).send("You must enter a date in the future.");
        }

        const movie = await client.db('Cinemate').collection('movies').findOne({ _id: new ObjectId(req.body.movieId) });
        if (!movie) return res.status(404).send("There is no movie with the given id.");

        const hall = await client.db('Cinemate').collection('halls').findOne({ _id: new ObjectId(req.body.hallId) });
        if (!hall) return res.status(404).send("There is no hall with the given id.");

        const [year, month, day] = req.body.date.split('-');
        const [hour, minute] = req.body.time.split(':');

        const screeningStartTime = new Date(year, month - 1, day, hour, minute);
        const screeningEndTime = new Date(screeningStartTime.getTime() + movie.duration * 60000);

        // Add 2 hours to the screening end time (because of time zones)
        const belgradeEndTime = new Date(screeningEndTime.getTime() + (2 * 60 * 60 * 1000));
        const belgradeEndTimeFormatted = belgradeEndTime.toISOString().substr(11, 5);

        // Check if the screening start time falls within the allowed hours (14:00 - 22:00):
        const earliestStartTime = new Date(year, month - 1, day, 14, 0);
        const latestStartTime = new Date(year, month - 1, day, 23, 0);
        if (screeningStartTime < earliestStartTime || screeningStartTime > latestStartTime) {
            return res.status(400).send("Screening start time is outside of allowed hours (14:00 - 23:00).");
        }

        // Check if the hall is available:
        const overlappingScreenings = await client.db('Cinemate').collection('screenings').find({
            hallId: req.body.hallId,
            date: req.body.date,
            $or: [
                { $and: [{ time: { $lte: req.body.time } }, { endTime: { $gt: req.body.time } }] },
                { $and: [{ time: { $lt: belgradeEndTimeFormatted } }, { time: { $gte: req.body.time } }] }
            ]
        }).toArray();

        if (overlappingScreenings.length > 0) {
            return res.status(400).send("The hall is not available at the given time.");
        }

        // Check for a 30-minute break between screenings:
        const previousScreenings = await client.db('Cinemate').collection('screenings').find({
            hallId: req.body.hallId,
            date: req.body.date,
            time: { $lt: req.body.time }
        }).sort({ time: -1 }).limit(1).toArray();

        const nextScreenings = await client.db('Cinemate').collection('screenings').find({
            hallId: req.body.hallId,
            date: req.body.date,
            time: { $gt: req.body.time }
        }).sort({ time: 1 }).limit(1).toArray();

        // Verify if there is at least a 30-minute break before the current screening
        if (previousScreenings.length > 0) {
            const previousScreeningEndTime = new Date(previousScreenings[0].date + ' ' + previousScreenings[0].endTime);
            if (screeningStartTime - previousScreeningEndTime < 30 * 60000) {
                return res.status(400).send("There must be at least a 30-minute break before the screening.");
            }
        }

        // Verify if there is at least a 30-minute break after the current screening
        if (nextScreenings.length > 0) {
            const nextScreeningStartTime = new Date(nextScreenings[0].date + ' ' + nextScreenings[0].time);
            if (nextScreeningStartTime - screeningEndTime < 30 * 60000) {
                return res.status(400).send("There must be at least a 30-minute break after the screening.");
            }
        }

        const newScreening = {
            date: req.body.date,
            time: req.body.time,
            endTime: belgradeEndTimeFormatted,
            numberOfAvailableSeats: hall.numberOfSeats,
            movieId: req.body.movieId,
            hallId: req.body.hallId
        };

        await client.db('Cinemate').collection('screenings').insertOne(newScreening);
        return res.status(200).send("Screening successfully added.");
    } catch (error) {
        console.error(error.stack);
        return res.status(500).send("Internal Server Error");
    } finally {
        client.close();
    }
});

// Update a screening:
router.put('/:id', [auth, admin], async (req, res) => {
    try {
        await client.connect();

        // Check the date:
        const screening = await client.db('Cinemate').collection('screenings').findOne({ _id: new ObjectId(req.params.id) });
        if (!screening) return res.status(404).send("There is no screening with the given id.");

        const screeningDate = new Date(screening.date);
        const currentDate = new Date();
        if (Math.round((screeningDate - currentDate) / (1000 * 60 * 60 * 24)) <= 1) return res.status(400).send("You cannot update a screening one day prior to it.");

        // Check if the body of the request is valid:
        const { error } = validateScreening(req.body);
        if (error) return res.status(400).send(error.details[0].message);

        // Date validation:
        if (new Date(req.body.date) < new Date()) {
            return res.status(400).send("You must enter a date in the future.");
        }

        const movie = await client.db('Cinemate').collection('movies').findOne({ _id: new ObjectId(req.body.movieId) });
        if (!movie) return res.status(404).send("There is no movie with the given id.");

        const hall = await client.db('Cinemate').collection('halls').findOne({ _id: new ObjectId(req.body.hallId) });
        if (!hall) return res.status(404).send("There is no hall with the given id.");

        const [year, month, day] = req.body.date.split('-');
        const [hour, minute] = req.body.time.split(':');

        const screeningStartTime = new Date(year, month - 1, day, hour, minute);
        const screeningEndTime = new Date(screeningStartTime.getTime() + movie.duration * 60000);

        // Add 2 hours to the screening end time (because of time zones)
        const belgradeEndTime = new Date(screeningEndTime.getTime() + (2 * 60 * 60 * 1000));
        const belgradeEndTimeFormatted = belgradeEndTime.toISOString().substr(11, 5);

        // Check if the screening start time falls within the allowed hours (14:00 - 22:00):
        const earliestStartTime = new Date(year, month - 1, day, 14, 0);
        const latestStartTime = new Date(year, month - 1, day, 23, 0);
        if (screeningStartTime < earliestStartTime || screeningStartTime > latestStartTime) {
            return res.status(400).send("Screening start time is outside of allowed hours (14:00 - 23:00).");
        }

        // Check if the hall is available:
        const overlappingScreenings = await client.db('Cinemate').collection('screenings').find({
            hallId: req.body.hallId,
            date: req.body.date,
            _id: { $not: { $eq: new ObjectId(req.params.id) } },
            $or: [
                { $and: [{ time: { $lte: req.body.time } }, { endTime: { $gt: req.body.time } }] },
                { $and: [{ time: { $lt: belgradeEndTimeFormatted } }, { time: { $gte: req.body.time } }] }
            ]
        }).toArray();

        if (overlappingScreenings.length > 0) {
            return res.status(400).send("The hall is not available at the given time.");
        }

        // Check for a 30-minute break between screenings:
        const previousScreenings = await client.db('Cinemate').collection('screenings').find({
            hallId: req.body.hallId,
            date: req.body.date,
            time: { $lt: req.body.time },
            _id: { $not: { $eq: new ObjectId(req.params.id) } }
        }).sort({ time: -1 }).limit(1).toArray();

        const nextScreenings = await client.db('Cinemate').collection('screenings').find({
            hallId: req.body.hallId,
            date: req.body.date,
            time: { $gt: req.body.time },
            _id: { $not: { $eq: new ObjectId(req.params.id) } }
        }).sort({ time: 1 }).limit(1).toArray();

        // Verify if there is at least a 30-minute break before the current screening
        if (previousScreenings.length > 0) {
            const previousScreeningEndTime = new Date(previousScreenings[0].date + ' ' + previousScreenings[0].endTime);
            if (screeningStartTime - previousScreeningEndTime < 30 * 60000) {
                return res.status(400).send("There must be at least a 30-minute break before the screening.");
            }
        }

        // Verify if there is at least a 30-minute break after the current screening
        if (nextScreenings.length > 0) {
            const nextScreeningStartTime = new Date(nextScreenings[0].date + ' ' + nextScreenings[0].time);
            if (nextScreeningStartTime - screeningEndTime < 30 * 60000) {
                return res.status(400).send("There must be at least a 30-minute break after the screening.");
            }
        }

        // Check if the new hall has enough seats:
        const currentHall = await client.db('Cinemate').collection('halls').findOne({ _id: new ObjectId(screening.hallId) });
        const newHall = await client.db('Cinemate').collection('halls').findOne({ _id: new ObjectId(req.body.hallId) });
        if (newHall.numberOfSeats < currentHall.numberOfSeats) return res.status(400).send("You cannot move the screening to a hall with a smaller capacity.");

        const numberOfReservations = (await client.db('Cinemate').collection('reservations').find({ _id: new ObjectId(req.params.id) }).toArray()).length;
        await client.db('Cinemate').collection('screenings').updateOne({ _id: new ObjectId(req.params.id) }, {
            $set: {
                date: req.body.date,
                time: req.body.time,
                endTime: belgradeEndTimeFormatted,
                numberOfAvailableSeats: newHall.numberOfSeats - numberOfReservations,
                movieId: req.body.movieId,
                hallId: req.body.hallId
            }
        });

        // check if there are reservations associated with the screening(if so notify the users) 

        return res.status(200).send("Screening successfully updated.");
    } catch (error) {
        console.error(error.stack);
        return res.status(500).send("Internal Server Error");
    } finally {
        client.close();
    }
});

// Remove a screening:
router.delete('/:id', [auth, admin], async (req, res) => {
    try {
        await client.connect();

        const screening = await client.db('Cinemate').collection('screenings').findOne({ _id: new ObjectId(req.params.id) });
        if (!screening) return res.status(404).send("There is no screening with the given id.");

        const screeningDate = new Date(screening.date);
        const currentDate = new Date();
        if (Math.round((screeningDate - currentDate) / (1000 * 60 * 60 * 24)) <= 1) return res.status(400).send("You cannot delete a screening one day prior to it.");

        const reservations = await client.db('Cinemate').collection('reservations').find({ screeningId: req.params.id }).toArray();
        if (reservations.length > 0) return res.status(400).send("You cannot delete this screening because there are reservations associated with it. Please remove all reservations associated with this screening first.");

        await client.db('Cinemate').collection('screenings').deleteOne({ _id: new ObjectId(req.params.id) });
        return res.status(200).send("Screening successfully removed.");
    } catch (error) {
        console.error(error.stack);
        return res.status(500).send("Internal Server Error");
    } finally {
        client.close();
    }
});

module.exports = router;