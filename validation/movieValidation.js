const Joi = require('joi');

module.exports = function validateMovie(movie) {
    const schema = Joi.object(
        {
            _id: Joi.any().forbidden().messages({
                'any.unknown': '_id is not allowed.'
            }),
            title: Joi.string().min(2).max(255).required().messages({
                'string.empty': 'Title cannot be empty.',
                'string.min': 'The title has to have at least 2 characters.',
                'string.max': 'The title cannot excede 255 characters.',
                'any.required': 'You must enter a title.'
            }),
            description: Joi.string().min(20).max(500).required().messages({
                'string.empty': 'Description cannot be empty.',
                'string.min': 'The description has to have at least 20 characters.',
                'string.max': 'The description cannot excede 500 characters.',
                'any.required': 'You must enter a description.'
            }),
            genre: Joi.string().min(5).max(255).required().messages({
                'string.empty': 'Genre cannot be empty.',
                'string.min': 'The genre has to have at least 5 characters.',
                'string.max': 'The genre cannot excede 255 characters.',
                'any.required': 'You must enter a genre.'
            }),
            director: Joi.string().min(5).max(255).required().messages({
                'string.empty': 'Director cannot be empty.',
                'string.min': 'The director has to have at least 5 characters.',
                'string.max': 'The director cannot excede 255 characters.',
                'any.required': 'You must enter a director.'
            }),
            releaseDate: Joi.string().regex(/^(\d{4})-(0?[1-9]|1[0-2])-(0?[1-9]|[12]\d|3[01])$/).required().messages({
                'string.pattern.base': 'Screening date must be in YYYY-MM-DD format.',
                'any.required': 'You must enter a release date.'
            }),
            duration: Joi.number().min(0).max(240).required().messages({
                'number.base': 'The duration must be a valid number.',
                'number.min': 'The duration of the movie cannot be less than 0 minutes.',
                'number.max': 'The duration of the movie cannot excede 240 minutes.',
                'any.required': 'You must enter the duration of the movie in minutes.'
            }),
            rating: Joi.number().min(1).max(10).required().messages({
                'number.base': 'The rating must be a valid number.',
                'number.min': 'The rating of the movie cannot be less than 1.',
                'number.max': 'The rating of the movie cannot excede 10.',
                'any.required': 'You must enter the rating of the movie.'
            })
        }
    );
    return schema.validate(movie);
}