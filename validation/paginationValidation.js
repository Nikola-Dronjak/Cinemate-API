const Joi = require('joi');

module.exports = function validatePagination(queryParameters) {
    const schema = Joi.object(
        {
            page: Joi.number().integer().min(1).default(1).messages({
                'number.base': 'The page number must be a valid number.',
                'number.min': 'The page number cannot be less than 1.'
            }),
            limit: Joi.number().integer().min(1).max(100).default(10).messages({
                'number.base': 'The limit must be a valid number.',
                'number.min': 'The limit cannot be less than 1.',
                'number.max': 'The limit cannot be less than 100.'
            })
        }
    );
    return schema.validate(queryParameters);
}