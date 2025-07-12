const { ObjectId } = require('mongodb');
const Joi = require('joi');

module.exports = function validateHall(hall) {
    const schema = Joi.object(
        {
            _id: Joi.any().forbidden().messages({
                'any.unknown': '_id is not allowed.'
            }),
            name: Joi.string().min(5).max(255).required().messages({
                'string.empty': 'Name cannot be empty.',
                'string.min': 'The name has to have at least 5 characters.',
                'string.max': 'The name cannot excede 255 characters.',
                'any.required': 'You must enter a name.'
            }),
            numberOfSeats: Joi.number().min(10).max(50).required().messages({
                'number.base': 'The number of seats must be a valid number.',
                'number.min': 'The hall has to have at least 10 seats.',
                'number.max': 'The hall cannot excede 50 seats.',
                'any.required': 'You must enter the number of seats in a hall.'
            }),
            cinemaId: Joi.string().required().custom((value, helpers) => {
                if (!ObjectId.isValid(value)) {
                    return helpers.error('any.invalid');
                }
            }).messages({
                'string.empty': 'CinemaId cannot be empty.',
                'any.invalid': 'The cinemaId has to be a valid ObjectId.',
                'any.required': 'You must enter a cinemaId.'
            })
        }
    );
    return schema.validate(hall);
}