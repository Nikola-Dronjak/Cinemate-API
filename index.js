const cors = require('cors');
const express = require('express');
const app = express();

const { connectToDatabase } = require('./database/db');

const user = require('./routes/user');
const cinema = require('./routes/cinema');
const hall = require('./routes/hall');
const movie = require('./routes/movie');
const screening = require('./routes/screening');
const reservation = require('./routes/reservation');

// Registering CRON jobs:
require('./cron/updateScreeningPricesJob')

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Allows requests from this address:
app.use(cors({ origin: '*' }));

app.use('/images', express.static('images'));

// Routes:
app.use(user);
app.use(cinema);
app.use(hall);
app.use(movie);
app.use(screening);
app.use(reservation);

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