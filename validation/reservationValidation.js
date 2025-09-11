const { ObjectId } = require('mongodb');
const Joi = require('joi');

module.exports = function validateReservation(reservation, { isCreate = true } = {}) {
    let schema;
    if (isCreate) {
        schema = Joi.object(
            {
                _id: Joi.any().forbidden().messages({
                    'any.unknown': '_id is not allowed.'
                }),
                userId: Joi.string().required().custom((value, helpers) => {
                    if (!ObjectId.isValid(value)) {
                        return helpers.error('any.invalid');
                    }
                }).messages({
                    'string.empty': 'UserId cannot be empty.',
                    'any.invalid': 'The userId has to be a valid ObjectId.',
                    'any.required': 'You must enter a userId.'
                }),
                screeningId: Joi.string().required().custom((value, helpers) => {
                    if (!ObjectId.isValid(value)) {
                        return helpers.error('any.invalid');
                    }
                }).messages({
                    'string.empty': 'ScreeningId cannot be empty.',
                    'any.invalid': 'The screeningId has to be a valid ObjectId.',
                    'any.required': 'You must enter a screeningId.'
                }),
                currency: Joi.string().valid('USD', 'EUR', 'CHF').required().messages({
                    'any.only': 'Currency must be one of USD, EUR, or CHF.',
                    'any.required': 'Currency is required.'
                }),
                redirectUrl: Joi.string().required().messages({
                    'string.empty': 'RedirectUrl cannot be empty.',
                    'any.required': 'RedirectUrl is required.'
                }),
            }
        );
    } else {
        schema = Joi.object({
            userId: Joi.string().required().custom((value, helpers) => {
                if (!ObjectId.isValid(value)) {
                    return helpers.error('any.invalid');
                }
                return value;
            }).messages({
                'string.empty': 'UserId cannot be empty.',
                'any.invalid': 'The userId has to be a valid ObjectId.',
                'any.required': 'You must enter a userId.'
            }),
            screeningId: Joi.string().required().custom((value, helpers) => {
                if (!ObjectId.isValid(value)) {
                    return helpers.error('any.invalid');
                }
                return value;
            }).messages({
                'string.empty': 'ScreeningId cannot be empty.',
                'any.invalid': 'The screeningId has to be a valid ObjectId.',
                'any.required': 'You must enter a screeningId.'
            })
        });
    }

    return schema.validate(reservation);
}