const { ObjectId } = require('mongodb');
const fs = require('fs');
const path = require('path');

const { getDb } = require('../database/db');
const validatePagination = require('../validation/paginationValidation');
const validateMovie = require('../validation/movieValidation');

const movieController = {
    async getMovies(req, res) {
        try {
            const { error, value } = validatePagination(req.query);
            if (error) return res.status(400).send({ message: error.details[0].message });

            const { page, limit } = value;
            const skip = (page - 1) * limit;

            let filter = {}
            const upcomingOnly = req.query.upcomingOnly;
            if (upcomingOnly === 'true') {
                const now = new Date();
                const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

                const nowFormatted = now.toISOString().slice(0, 10);
                const sevenDaysFromNowFormatted = sevenDaysFromNow.toISOString().slice(0, 10);

                const movieIds = await getDb().collection('screenings').distinct('movieId', { date: { $gte: nowFormatted, $lte: sevenDaysFromNowFormatted } });
                if (movieIds.length === 0) {
                    return res.status(404).send({ message: "There are no movies with screenings in the next 7 days." });
                }
                filter = { _id: { $in: movieIds.map(id => new ObjectId(id)) } };
            }

            const totalMovies = await getDb().collection('movies').countDocuments(filter);
            const totalPages = Math.ceil(totalMovies / limit);

            var movies = await getDb().collection('movies').find(filter).skip(skip).limit(limit).toArray();;
            if (movies.length === 0) return res.status(404).send({ message: "There are no movies in the database right now." });
            movies = movies.map(movie => ({
                ...movie,
                links: [
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/movies/${movie._id}`, action: 'GET', types: [] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/movies/${movie._id}`, action: 'PUT', types: ["multipart/form-data"] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/movies/${movie._id}`, action: 'DELETE', types: [] }
                ]
            }));
            return res.status(200).send({
                page,
                limit,
                totalPages,
                totalMovies,
                movies,
                links: [
                    ...(page > 1 ? [{ rel: 'prev', href: `${req.protocol}://${req.get("host")}/api/movies?page=${page - 1}&limit=${limit}`, action: 'GET', types: [] }] : []),
                    ...(page < totalPages ? [{ rel: 'next', href: `${req.protocol}://${req.get("host")}/api/movies?page=${page + 1}&limit=${limit}`, action: 'GET', types: [] }] : []),
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/movies?page=${page}&limit=${limit}`, action: 'GET', types: [] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/movies`, action: 'POST', types: ["multipart/form-data"] }
                ]
            });
        } catch (error) {
            console.error(error.stack);
            return res.status(500).send({ message: "Internal Server Error" });
        }
    },

    async getMovie(req, res) {
        try {
            const movie = await getDb().collection('movies').findOne({ _id: new ObjectId(req.params.id) });
            if (!movie) return res.status(404).send({ message: "There is no movie with the given id." });
            return res.status(200).send({
                ...movie,
                links: [
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/movies`, action: 'GET', types: [] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/movies/${movie._id}`, action: 'GET', types: [] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/movies/${movie._id}`, action: 'PUT', types: ["multipart/form-data"] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/movies/${movie._id}`, action: 'DELETE', types: [] }
                ]
            });
        } catch (error) {
            console.error(error.stack);
            return res.status(500).send({ message: "Internal Server Error" });
        }
    },

    async createMovie(req, res) {
        try {
            const { image, ...validatedBody } = req.body;
            const { error } = validateMovie(validatedBody);
            if (error) return res.status(400).send({ message: error.details[0].message });

            if (!req.file) return res.status(400).send({ message: "Movie image is required." });

            const existingMovie = await getDb().collection('movies').findOne({ title: req.body.title });
            if (existingMovie !== null) return res.status(409).send({ movie: "This movie already exists." });

            const newMovie = {
                title: req.body.title,
                description: req.body.description,
                genre: req.body.genre,
                director: req.body.director,
                releaseDate: req.body.releaseDate,
                duration: parseInt(req.body.duration, 10),
                image: req.file.filename,
                rating: parseFloat(req.body.rating)
            };

            const result = await getDb().collection('movies').insertOne(newMovie);
            newMovie._id = result.insertedId;
            return res.status(201).header("Location", `${req.protocol}://${req.get("host")}/api/movies/${newMovie._id}`).send({
                ...newMovie,
                links: [
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/movies`, action: 'GET', types: [] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/movies/${newMovie._id}`, action: 'GET', types: [] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/movies/${newMovie._id}`, action: 'PUT', types: ["multipart/form-data"] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/movies/${newMovie._id}`, action: 'DELETE', types: [] }
                ]
            });
        } catch (error) {
            console.error(error.stack);
            return res.status(500).send({ message: "Internal Server Error" });
        }
    },

    async updateMovie(req, res) {
        try {
            const movie = await getDb().collection('movies').findOne({ _id: new ObjectId(req.params.id) });
            if (!movie) return res.status(404).send({ message: "There is no movie with the given id." });

            const screenings = await getDb().collection('screenings').find({ hallId: req.params.id }).toArray();
            if (screenings.length > 0) return res.status(409).send({ message: "You cannot update this movie because there are screenings associated with it. Please remove all screenings associated with this movie first." });

            const { image, ...validatedBody } = req.body;
            const { error } = validateMovie(validatedBody);
            if (error) return res.status(400).send({ message: error.details[0].message });

            const existingMovie = await getDb().collection('movies').findOne({
                _id: { $not: { $eq: new ObjectId(req.params.id) } },
                title: req.body.title
            });
            if (existingMovie !== null) return res.status(409).send({ message: "This movie already exists." });

            var updatedMovie = {
                title: req.body.title,
                description: req.body.description,
                genre: req.body.genre,
                director: req.body.director,
                releaseDate: req.body.releaseDate,
                duration: parseInt(req.body.duration, 10),
                rating: parseFloat(req.body.rating)
            };

            if (req.file) {
                if (movie.image) {
                    const oldImagePath = path.join(__dirname, '../images', movie.image);
                    fs.unlink(oldImagePath, (err) => {
                        if (err) console.error(`Failed to delete old image: ${oldImagePath}`, err);
                    });
                }
                updatedMovie.image = req.file.filename;
            }

            await getDb().collection('movies').updateOne({ _id: new ObjectId(req.params.id) }, { $set: updatedMovie });
            updatedMovie = await getDb().collection('movies').findOne({ _id: new ObjectId(req.params.id) });
            return res.status(200).send({
                ...updatedMovie,
                links: [
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/movies`, action: 'GET', types: [] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/movies/${updatedMovie._id}`, action: 'GET', types: [] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/movies/${updatedMovie._id}`, action: 'PUT', types: ["multipart/form-data"] },
                    { rel: 'self', href: `${req.protocol}://${req.get("host")}/api/movies/${updatedMovie._id}`, action: 'DELETE', types: [] }
                ]
            });
        } catch (error) {
            console.error(error.stack);
            return res.status(500).send({ message: "Internal Server Error" });
        }
    },

    async deleteMovie(req, res) {
        try {
            const movie = await getDb().collection('movies').findOne({ _id: new ObjectId(req.params.id) });
            if (!movie) return res.status(404).send({ message: "There is no movie with the given id." });

            const screenings = await getDb().collection('screenings').find({ movieId: req.params.id }).toArray();
            if (screenings.length > 0) return res.status(409).send({ message: "You cannot delete this movie because there are screenings associated with it. Please remove all screenings associated with this movie first." });

            await getDb().collection('movies').deleteOne({ _id: new ObjectId(req.params.id) });
            const imagePath = path.join(__dirname, '../images', movie.image);
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

module.exports = { movieController }