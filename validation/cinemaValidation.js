const Joi = require('joi');

module.exports = function validateCinema(cinema) {
    const schema = Joi.object(
        {
            name: Joi.string().min(5).max(255).required().messages({
                'string.empty': 'Name cannot be empty.',
                'string.min': 'The name has to have at least 5 characters.',
                'string.max': 'The name cannot excede 255 characters.',
                'any.required': 'You must enter a name.'
            }),
            address: Joi.string().min(5).max(255).required().messages({
                'string.empty': 'Address cannot be empty.',
                'string.min': 'The address has to have at least 5 characters.',
                'string.max': 'The address cannot excede 255 characters.',
                'any.required': 'You must enter an address.'
            }),
            city: Joi.string().min(2).max(255).required().messages({
                'string.empty': 'City cannot be empty.',
                'string.min': 'The city has to have at least 2 characters.',
                'string.max': 'The city cannot excede 255 characters.',
                'any.required': 'You must enter a city.'
            })
        }
    );
    return schema.validate(cinema);
}