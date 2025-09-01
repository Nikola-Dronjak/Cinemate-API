const Joi = require('joi');

const roles = ['Customer', 'Sales', 'Admin'];

module.exports = function validateUser(user, { isUpdate = false, changedRole = false } = {}) {
    let schema;
    if (changedRole) {
        schema = Joi.object({
            role: Joi.string().valid(...roles).required().messages({
                'any.only': `Role must be one of: ${roles.join(', ')}.`,
                'any.required': 'Role is required when changing user role.'
            })
        });
    } else {
        schema = Joi.object(
            {
                _id: Joi.any().forbidden().messages({
                    'any.unknown': '_id is not allowed.'
                }),
                username: Joi.string().min(6).max(255).required().messages({
                    'string.empty': 'Username cannot be empty.',
                    'string.min': 'The username has to have at least 6 characters.',
                    'string.max': 'The username cannot excede 255 characters.',
                    'any.required': 'You must enter a username.'
                }),
                email: Joi.string().email().max(255).required().messages({
                    'string.empty': 'Email cannot be empty.',
                    'string.email': 'The email must be a valid email address.',
                    'string.max': 'The email cannot excede 255 characters.',
                    'any.required': 'You must enter an email address.'
                }),
                password: isUpdate
                    ? Joi.string().min(8).max(255).optional().allow('').messages({
                        'string.min': 'The password has to have at least 8 characters',
                        'string.max': 'The password cannot excede 255 characters.'
                    })
                    : Joi.string().min(8).max(255).required().messages({
                        'string.empty': 'Password cannot be empty.',
                        'string.min': 'The password has to have at least 8 characters',
                        'string.max': 'The password cannot excede 255 characters.',
                        'any.required': 'You must enter a password.'
                    })
            }
        ).unknown(true);
    }
    return schema.validate(user);
}