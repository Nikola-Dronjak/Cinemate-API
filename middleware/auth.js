const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
    const token = req.header('x-auth-token');
    if (!token) return res.status(401).send({ message: "Access denied. No token provided." });
    try {
        const decoded_payload = jwt.verify(token, 'jwtPrivateToken');
        req.user = decoded_payload;
        next();
    } catch (ex) {
        if (ex.name === 'TokenExpiredError') {
            return res.status(401).send({ message: 'Token expired.' });
        }
        res.status(400).send({ message: 'Invalid token.' });
    }
}