const { ObjectId } = require('mongodb');
const Joi = require('joi');

module.exports = function validateScreening(screening) {
    const schema = Joi.object(
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
            })
        }
    );
    return schema.validate(screening);
}