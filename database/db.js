const { MongoClient, ServerApiVersion } = require('mongodb');

const uri = "mongodb+srv://Admin:admin@cluster0.cv0sz3z.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: false,
        deprecationErrors: true,
    }
});

let db;

async function connectToDatabase() {
    if (!db) {
        await client.connect();
        db = client.db('Cinemate');
        console.log("Connected to MongoDB");
    }
    return db;
}

function getDb() {
    if (!db) console.log("Connection to MongoDB failed.");
    return db;
}

module.exports = {
    connectToDatabase,
    getDb
};