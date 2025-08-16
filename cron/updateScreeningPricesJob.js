const cron = require('node-cron');

const { getDb } = require('../database/db');

async function updatePrices() {
    try {
        let eurToUSD = 0;
        let eurToCHF = 0;
        await fetch("https://api.frankfurter.dev/v1/latest?symbols=USD,CHF")
            .then((resp) => resp.json())
            .then((data) => {
                eurToUSD = data.rates.USD;
                eurToCHF = data.rates.CHF;
            })
            .catch((error) => {
                console.error("Failed to fetch exchange rates: " + error.stack);
            });

        const screeningIds = await getDb().collection('reservations').distinct('screeningId');
        await getDb().collection('screenings').updateMany(
            {
                _id: { $nin: screeningIds },
                date: { $gt: new Date() }
            },
            [{ $set: { priceUSD: { $round: [{ $multiply: ['$priceEUR', eurToUSD] }, 2] }, priceCHF: { $round: [{ $multiply: ['$priceEUR', eurToCHF] }, 2] } } }]
        );
        console.log("Screening prices updated");
    } catch (error) {
        console.error("Failed updating exchange rates", error);
    }
}

cron.schedule('0 17 * * *', async () => {
    await updatePrices();
});

module.exports = updatePrices;