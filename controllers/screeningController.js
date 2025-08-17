const { ObjectId } = require('mongodb');

const { getDb } = require('../database/db');
const validatePagination = require('../validation/paginationValidation');
const validateScreening = require('../validation/screeningValidation');

const screeningController = {
    async getScreeningsOfMovie(req, res) {
        try {
            const { error, value } = validatePagination(req.query);
            if (error) return res.status(400).send({ message: error.details[0].message });

            const { page, limit } = value;
            const skip = (page - 1) * limit;

            const movie = await getDb().collection('movies').findOne({ _id: new ObjectId(req.params.movieId) });
            if (!movie) return res.status(404).send({ message: "There is no movie with the given id." });

            let filter = { movieId: req.params.movieId };
            const upcomingOnly = req.query.upcomingOnly;
            if (upcomingOnly === 'true') {
                const now = new Date();
                const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

                const nowFormatted = now.toISOString().slice(0, 10);
                const sevenDaysFromNowFormatted = sevenDaysFromNow.toISOString().slice(0, 10);
                filter.date = { $gte: nowFormatted, $lte: sevenDaysFromNowFormatted };
            }

            const totalScreenings = await getDb().collection('screenings').countDocuments(filter);
            const totalPages = Math.ceil(totalScreenings / limit);

            var screeningsOfMovie = await getDb().collection('screenings').find(filter).sort({ date: -1, time: -1 }).skip(skip).limit(limit).toArray();
            if (screeningsOfMovie.length === 0) return res.status(404).send({ message: "There are no screenings for this movie right now." });
            screeningsOfMovie = screeningsOfMovie.map(screening => ({
                ...screening,
                links: [
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/screenings/${screening._id}`, action: 'GET', types: [] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/screenings/${screening._id}`, action: 'PUT', types: ["application/json"] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/screenings/${screening._id}`, action: 'DELETE', types: [] }
                ]
            }));
            return res.status(200).send({
                page,
                limit,
                totalPages,
                totalScreenings,
                screeningsOfMovie,
                links: [
                    { rel: 'movie', href: `${req.protocol}://${req.get("host")}/api/movies/${movie._id}`, action: 'GET', types: [] },
                    ...(page > 1 ? [{ rel: 'prev', href: `${req.protocol}://${req.get("host")}/api/movies/${movie._id}/screenings?page=${page - 1}&limit=${limit}`, action: 'GET', types: [] }] : []),
                    ...(page < totalPages ? [{ rel: 'next', href: `${req.protocol}://${req.get("host")}/api/movies/${movie._id}/screenings?page=${page + 1}&limit=${limit}`, action: 'GET', types: [] }] : []),
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/movies/${movie._id}/screenings?page=${page}&limit=${limit}`, action: 'GET', types: [] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/screenings`, action: 'POST', types: ["application/json"] }
                ]
            });
        } catch (error) {
            console.error(error.stack);
            return res.status(500).send({ message: "Internal Server Error" });
        }
    },

    async getScreeningsForHall(req, res) {
        try {
            const { error, value } = validatePagination(req.query);
            if (error) return res.status(400).send({ message: error.details[0].message });

            const { page, limit } = value;
            const skip = (page - 1) * limit;

            const totalScreenings = await getDb().collection('screenings').countDocuments({ hallId: req.params.hallId });
            const totalPages = Math.ceil(totalScreenings / limit);

            const hall = await getDb().collection('halls').findOne({ _id: new ObjectId(req.params.hallId) });
            if (!hall) return res.status(404).send({ message: "There is no hall with the given id." });

            var screeningsForHall = await getDb().collection('screenings').find({ hallId: req.params.hallId }).skip(skip).limit(limit).toArray();
            if (screeningsForHall.length === 0) return res.status(404).send({ message: "There are no screenings in this hall right now." });
            screeningsForHall = screeningsForHall.map(screening => ({
                ...screening,
                links: [
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/screenings/${screening._id}`, action: 'GET', types: [] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/screenings/${screening._id}`, action: 'PUT', types: ["application/json"] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/screenings/${screening._id}`, action: 'DELETE', types: [] }
                ]
            }));
            return res.status(200).send({
                page,
                limit,
                totalPages,
                totalScreenings,
                screeningsForHall,
                links: [
                    { rel: 'hall', href: `${req.protocol}://${req.get("host")}/api/halls/${hall._id}`, action: 'GET', types: [] },
                    ...(page > 1 ? [{ rel: 'prev', href: `${req.protocol}://${req.get("host")}/api/halls/${hall._id}/screenings?page=${page - 1}&limit=${limit}`, action: 'GET', types: [] }] : []),
                    ...(page < totalPages ? [{ rel: 'next', href: `${req.protocol}://${req.get("host")}/api/halls/${hall._id}/screenings?page=${page + 1}&limit=${limit}`, action: 'GET', types: [] }] : []),
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/halls/${hall._id}/screenings?page=${page}&limit=${limit}`, action: 'GET', types: [] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/screenings`, action: 'POST', types: ["application/json"] }
                ]
            });
        } catch (error) {
            console.error(error.stack);
            return res.status(500).send({ message: "Internal Server Error" });
        }
    },

    async getScreening(req, res) {
        try {
            const screening = await getDb().collection('screenings').findOne({ _id: new ObjectId(req.params.id) });
            if (!screening) return res.status(404).send({ message: "There is no screening with the given id." });

            return res.status(200).send({
                ...screening,
                links: [
                    { rel: 'movie', href: `${req.protocol}://${req.get("host")}/api/movies/${screening.movieId}`, action: 'GET', types: [] },
                    { rel: 'hall', href: `${req.protocol}://${req.get("host")}/api/halls/${screening.hallId}`, action: 'GET', types: [] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/movies/${screening.movieId}/screenings`, action: 'GET', types: [] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/halls/${screening.hallId}/screenings`, action: 'GET', types: [] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/screenings/${screening._id}`, action: 'GET', types: [] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/screenings/${screening._id}`, action: 'PUT', types: ["application/json"] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/screenings/${screening._id}`, action: 'DELETE', types: [] }
                ]
            });
        } catch (error) {
            console.error(error.stack);
            return res.status(500).send({ message: "Internal Server Error" });
        }
    },

    async createScreening(req, res) {
        try {
            // Check if the body of the request is valid:
            const { error } = validateScreening(req.body);
            if (error) return res.status(400).send({ message: error.details[0].message });

            // Date validation:
            if (new Date(req.body.date) < new Date()) {
                return res.status(400).send({ message: "You must enter a date in the future." });
            }

            const movie = await getDb().collection('movies').findOne({ _id: new ObjectId(req.body.movieId) });
            if (!movie) return res.status(404).send({ message: "There is no movie with the given id." });

            const hall = await getDb().collection('halls').findOne({ _id: new ObjectId(req.body.hallId) });
            if (!hall) return res.status(404).send({ message: "There is no hall with the given id." });

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
                return res.status(409).send({ message: "Screening start time is outside of allowed hours (14:00 - 23:00)." });
            }

            // Check if the hall is available:
            const overlappingScreenings = await getDb().collection('screenings').find({
                hallId: req.body.hallId,
                date: req.body.date,
                $or: [
                    { $and: [{ time: { $lte: req.body.time } }, { endTime: { $gt: req.body.time } }] },
                    { $and: [{ time: { $lt: belgradeEndTimeFormatted } }, { time: { $gte: req.body.time } }] }
                ]
            }).toArray();

            if (overlappingScreenings.length > 0) {
                return res.status(409).send({ message: "The hall is not available at the given time." });
            }

            // Check for a 30-minute break between screenings:
            const previousScreenings = await getDb().collection('screenings').find({
                hallId: req.body.hallId,
                date: req.body.date,
                time: { $lt: req.body.time }
            }).sort({ time: -1 }).limit(1).toArray();

            const nextScreenings = await getDb().collection('screenings').find({
                hallId: req.body.hallId,
                date: req.body.date,
                time: { $gt: req.body.time }
            }).sort({ time: 1 }).limit(1).toArray();

            // Verify if there is at least a 30-minute break before the current screening
            if (previousScreenings.length > 0) {
                const previousScreeningEndTime = new Date(previousScreenings[0].date + ' ' + previousScreenings[0].endTime);
                if (screeningStartTime - previousScreeningEndTime < 30 * 60000) {
                    return res.status(409).send({ message: "There must be at least a 30-minute break before the screening." });
                }
            }

            // Verify if there is at least a 30-minute break after the current screening
            if (nextScreenings.length > 0) {
                const nextScreeningStartTime = new Date(nextScreenings[0].date + ' ' + nextScreenings[0].time);
                if (nextScreeningStartTime - screeningEndTime < 30 * 60000) {
                    return res.status(409).send({ message: "There must be at least a 30-minute break after the screening." });
                }
            }

            let eurToUSD = 0;
            let eurToCHF = 0;
            await fetch("https://api.frankfurter.dev/v1/latest?symbols=USD,CHF")
                .then((resp) => resp.json())
                .then((data) => {
                    eurToUSD = data.rates.USD;
                    eurToCHF = data.rates.CHF;
                })
                .catch((error) => {
                    console.error(error.stack);
                    return res.status(502).send({ message: "Failed to fetch exchange rates." });
                });

            const newScreening = {
                date: req.body.date,
                time: req.body.time,
                endTime: belgradeEndTimeFormatted,
                movieId: req.body.movieId,
                hallId: req.body.hallId,
                numberOfAvailableSeats: hall.numberOfSeats,
                basePriceEUR: req.body.basePriceEUR,
                basePriceUSD: req.body.basePriceEUR * eurToUSD,
                basePriceCHF: req.body.basePriceEUR * eurToCHF,
                discount: 0,
                priceEUR: req.body.basePriceEUR,
                priceUSD: req.body.basePriceEUR * eurToUSD,
                priceCHF: req.body.basePriceEUR * eurToCHF
            };

            const result = await getDb().collection('screenings').insertOne(newScreening);
            newScreening._id = result.insertedId;
            return res.status(201).header("Location", `${req.protocol}://${req.get("host")}/api/screenings/${newScreening._id}`).send({
                ...newScreening,
                links: [
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/movies/${newScreening.movieId}/screenings`, action: 'GET', types: [] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/halls/${newScreening.hallId}/screenings`, action: 'GET', types: [] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/screenings/${newScreening._id}`, action: 'GET', types: [] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/screenings/${newScreening._id}`, action: 'PUT', types: ["application/json"] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/screenings/${newScreening._id}`, action: 'DELETE', types: [] }
                ]
            });
        } catch (error) {
            console.error(error.stack);
            return res.status(500).send({ message: "Internal Server Error" });
        }
    },

    async updateScreening(req, res) {
        try {
            const screening = await getDb().collection('screenings').findOne({ _id: new ObjectId(req.params.id) });
            if (!screening) return res.status(404).send({ message: "There is no screening with the given id." });

            const reservations = await getDb().collection('reservations').find({ screeningId: req.params.id }).toArray();
            if (reservations.length > 0) return res.status(409).send({ message: "You cannot update this screening because there are reservations associated with it. Please remove all reservations associated with this screening first." });

            // Check the date:
            const screeningDate = new Date(screening.date);
            const currentDate = new Date();
            if (Math.round((screeningDate - currentDate) / (1000 * 60 * 60 * 24)) <= 1) return res.status(409).send({ message: "You cannot update a screening one day prior to it." });

            // Check if the body of the request is valid:
            const { error } = validateScreening(req.body);
            if (error) return res.status(400).send({ message: error.details[0].message });

            // Date validation:
            if (new Date(req.body.date) < new Date()) {
                return res.status(400).send({ message: "You must enter a date in the future." });
            }

            const movie = await getDb().collection('movies').findOne({ _id: new ObjectId(req.body.movieId) });
            if (!movie) return res.status(404).send({ message: "There is no movie with the given id." });

            const hall = await getDb().collection('halls').findOne({ _id: new ObjectId(req.body.hallId) });
            if (!hall) return res.status(404).send({ message: "There is no hall with the given id." });

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
                return res.status(409).send({ message: "Screening start time is outside of allowed hours (14:00 - 23:00)." });
            }

            // Check if the hall is available:
            const overlappingScreenings = await getDb().collection('screenings').find({
                hallId: req.body.hallId,
                date: req.body.date,
                _id: { $not: { $eq: new ObjectId(req.params.id) } },
                $or: [
                    { $and: [{ time: { $lte: req.body.time } }, { endTime: { $gt: req.body.time } }] },
                    { $and: [{ time: { $lt: belgradeEndTimeFormatted } }, { time: { $gte: req.body.time } }] }
                ]
            }).toArray();

            if (overlappingScreenings.length > 0) {
                return res.status(409).send({ message: "The hall is not available at the given time." });
            }

            // Check for a 30-minute break between screenings:
            const previousScreenings = await getDb().collection('screenings').find({
                hallId: req.body.hallId,
                date: req.body.date,
                time: { $lt: req.body.time },
                _id: { $not: { $eq: new ObjectId(req.params.id) } }
            }).sort({ time: -1 }).limit(1).toArray();

            const nextScreenings = await getDb().collection('screenings').find({
                hallId: req.body.hallId,
                date: req.body.date,
                time: { $gt: req.body.time },
                _id: { $not: { $eq: new ObjectId(req.params.id) } }
            }).sort({ time: 1 }).limit(1).toArray();

            // Verify if there is at least a 30-minute break before the current screening
            if (previousScreenings.length > 0) {
                const previousScreeningEndTime = new Date(previousScreenings[0].date + ' ' + previousScreenings[0].endTime);
                if (screeningStartTime - previousScreeningEndTime < 30 * 60000) {
                    return res.status(409).send({ message: "There must be at least a 30-minute break before the screening." });
                }
            }

            // Verify if there is at least a 30-minute break after the current screening
            if (nextScreenings.length > 0) {
                const nextScreeningStartTime = new Date(nextScreenings[0].date + ' ' + nextScreenings[0].time);
                if (nextScreeningStartTime - screeningEndTime < 30 * 60000) {
                    return res.status(409).send({ message: "There must be at least a 30-minute break after the screening." });
                }
            }

            // Check if the new hall has enough seats:
            const currentHall = await getDb().collection('halls').findOne({ _id: new ObjectId(screening.hallId) });
            const newHall = await getDb().collection('halls').findOne({ _id: new ObjectId(req.body.hallId) });
            if (newHall.numberOfSeats < currentHall.numberOfSeats) return res.status(409).send({ message: "You cannot move the screening to a hall with a smaller capacity." });

            let eurToUSD = 0;
            let eurToCHF = 0;
            await fetch("https://api.frankfurter.dev/v1/latest?symbols=USD,CHF")
                .then((resp) => resp.json())
                .then((data) => {
                    eurToUSD = data.rates.USD;
                    eurToCHF = data.rates.CHF;
                })
                .catch((error) => {
                    console.error(error.stack);
                    return res.status(502).send({ message: "Failed to fetch exchange rates." });
                });

            const numberOfReservations = (await getDb().collection('reservations').find({ _id: new ObjectId(req.params.id) }).toArray()).length;
            await getDb().collection('screenings').updateOne({ _id: new ObjectId(req.params.id) }, {
                $set: {
                    date: req.body.date,
                    time: req.body.time,
                    endTime: belgradeEndTimeFormatted,
                    movieId: req.body.movieId,
                    hallId: req.body.hallId,
                    numberOfAvailableSeats: newHall.numberOfSeats - numberOfReservations,
                    basePriceEUR: req.body.basePriceEUR,
                    basePriceUSD: req.body.basePriceEUR * eurToUSD,
                    basePriceCHF: req.body.basePriceEUR * eurToCHF,
                    discount: req.body.discount,
                    priceEUR: req.body.basePriceEUR * (1 - (req.body.discount / 100)),
                    priceUSD: req.body.basePriceEUR * eurToUSD * (1 - (req.body.discount / 100)),
                    priceCHF: req.body.basePriceEUR * eurToCHF * (1 - (req.body.discount / 100)),
                }
            });

            const updatedScreening = await getDb().collection('screenings').findOne({ _id: new ObjectId(req.params.id) });
            return res.status(200).send({
                ...updatedScreening,
                links: [
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/movies/${updatedScreening.movieId}/screenings`, action: 'GET', types: [] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/halls/${updatedScreening.hallId}/screenings`, action: 'GET', types: [] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/screenings/${updatedScreening._id}`, action: 'GET', types: [] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/screenings/${updatedScreening._id}`, action: 'PUT', types: ["application/json"] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/screenings/${updatedScreening._id}`, action: 'DELETE', types: [] }
                ]
            });
        } catch (error) {
            console.error(error.stack);
            return res.status(500).send({ message: "Internal Server Error" });
        }
    },

    async addDiscount(req, res) {
        try {
            const screening = await getDb().collection('screenings').findOne({ _id: new ObjectId(req.params.id) });
            if (!screening) return res.status(404).send({ message: "There is no screening with the given id." });

            if (req.body.discount < 0 || req.body.discount > 100) return res.status(400).send({ message: "The discount for the movie screening must be between 0 and 100." });

            const reservations = await getDb().collection('reservations').find({ screeningId: req.params.id }).toArray()
            if (reservations.length > 0) return res.status(409).send({ message: "You cannot add a discount for a screening that already has reservations." });

            await getDb().collection('screenings').updateOne({ _id: new ObjectId(req.params.id) }, {
                $set: {
                    discount: req.body.discount,
                    priceEUR: screening.basePriceEUR * (1 - (req.body.discount / 100)),
                    priceUSD: screening.basePriceUSD * (1 - (req.body.discount / 100)),
                    priceCHF: screening.basePriceCHF * (1 - (req.body.discount / 100)),
                }
            });

            const updatedScreening = await getDb().collection('screenings').findOne({ _id: new ObjectId(req.params.id) });
            return res.status(200).send({
                ...updatedScreening,
                links: [
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/movies/${updatedScreening.movieId}/screenings`, action: 'GET', types: [] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/halls/${updatedScreening.hallId}/screenings`, action: 'GET', types: [] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/screenings/${updatedScreening._id}`, action: 'GET', types: [] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/screenings/${updatedScreening._id}`, action: 'PUT', types: ["application/json"] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/screenings/${updatedScreening._id}`, action: 'DELETE', types: [] }
                ]
            });
        } catch (error) {
            console.error(error.stack);
            return res.status(500).send({ message: "Internal Server Error" });
        }
    },

    async deleteScreening(req, res) {
        try {
            const screening = await getDb().collection('screenings').findOne({ _id: new ObjectId(req.params.id) });
            if (!screening) return res.status(404).send({ message: "There is no screening with the given id." });

            const screeningDate = new Date(screening.date);
            const currentDate = new Date();
            if (Math.round((screeningDate - currentDate) / (1000 * 60 * 60 * 24)) <= 1) return res.status(409).send({ message: "You cannot delete a screening one day prior to it." });

            const reservations = await getDb().collection('reservations').find({ screeningId: req.params.id }).toArray();
            if (reservations.length > 0) return res.status(409).send({ message: "You cannot delete this screening because there are reservations associated with it. Please remove all reservations associated with this screening first." });

            await getDb().collection('screenings').deleteOne({ _id: new ObjectId(req.params.id) });
            return res.status(204).send();
        } catch (error) {
            console.error(error.stack);
            return res.status(500).send({ message: "Internal Server Error" });
        }
    }
}

module.exports = { screeningController };