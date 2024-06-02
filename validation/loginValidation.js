const Joi = require('joi');

module.exports = function validateLogin(input) {
    const schema = Joi.object(
        {
            email: Joi.string().email().max(255).required().messages({
                'string.empty': 'Email cannot be empty.',
                'string.email': 'The email must be a valid email address.',
                'string.max': 'The email cannot excede 255 characters.',
                'any.required': 'You must enter an email address.'
            }),
            password: Joi.string().max(255).required().messages({
                'string.empty': 'Password cannot be empty.',
                'string.max': 'The password cannot excede 255 characters.',
                'any.required': 'You must enter a password.'
            })
        }
    );
    return schema.validate(input);
}