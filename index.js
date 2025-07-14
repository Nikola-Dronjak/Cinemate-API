const cors = require('cors');
const express = require('express');
const app = express();

const { connectToDatabase } = require('./database/db');

const register = require('./routes/register');
const login = require('./routes/login');
const user = require('./routes/user');
const cinema = require('./routes/cinema');
const hall = require('./routes/hall');
const movie = require('./routes/movie');
const screening = require('./routes/screening');
const reservation = require('./routes/reservation');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Allows requests from this address:
app.use(cors({ origin: '*' }));

app.use('/images', express.static('images'));

// Routes:
app.use('/api/register', register);
app.use('/api/login', login);
app.use('/api/users', user);
app.use('/api/cinemas', cinema);
app.use(hall);
app.use(movie);
app.use(screening);
app.use('/api/reservations', reservation);

const port = process.env.PORT || 3000;

(async () => {
    try {
        await connectToDatabase();
        app.listen(port, () => console.log(`Listening on port ${port}...`));
    } catch (err) {
        client.close();
        process.exit(1);
    }
})();