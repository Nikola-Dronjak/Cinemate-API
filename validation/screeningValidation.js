const { ObjectId } = require('mongodb');
const Joi = require('joi');

module.exports = function validateScreening(screening) {
    const schema = Joi.object(
        {
            date: Joi.string().regex(/^(\d{4})-(0?[1-9]|1[0-2])-(0?[1-9]|[12]\d|3[01])$/).required().messages({
                'string.pattern.base': 'Screening date must be in YYYY-MM-DD format.',
                'any.required': 'You must enter a screening date.'
            }),
            time: Joi.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).required().messages({
                'string.pattern.base': 'Screening time must be in HH:MM format (24-hour).',
                'any.required': 'You must enter a screening time.'
            }),
            movieId: Joi.string().required().custom((value, helpers) => {
                if (!ObjectId.isValid(value)) {
                    return helpers.error('any.invalid');
                }
            }).messages({
                'string.empty': 'MovieId cannot be empty.',
                'any.invalid': 'The movieId has to be a valid ObjectId.',
                'any.required': 'You must enter a movieId.'
            }),
            hallId: Joi.string().required().custom((value, helpers) => {
                if (!ObjectId.isValid(value)) {
                    return helpers.error('any.invalid');
                }
            }).messages({
                'string.empty': 'HallId cannot be empty.',
                'any.invalid': 'The hallId has to be a valid ObjectId.',
                'any.required': 'You must enter a hallId.'
            })
        }
    );
    return schema.validate(screening);
}