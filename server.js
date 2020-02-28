// Load Environment Variables from the .env file
require('dotenv').config();

// Application Dependencies
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
// Database Client
const client = require('./lib/client.js');
// Services
const request = require('superagent');
// Auth
const createAuthRoutes = require('./lib/auth/create-auth-routes');
const authRoutes = createAuthRoutes({
    async selectUser(email) {
        const result = await client.query(`
            SELECT id, email, hash, display_name 
            FROM users
            WHERE email = $1;
        `, [email]);
        return result.rows[0];
    },
    async insertUser(user, hash) {
        console.log(user);
        const result = await client.query(`
            INSERT into users (email, hash, display_name)
            VALUES ($1, $2, $3)
            RETURNING id, email, display_name;
        `, [user.email, hash, user.display_name]);
        return result.rows[0];
    }
});

// Application Setup
const app = express();
app.use(morgan('dev')); // http logging
app.use(cors()); // enable CORS request
app.use(express.static('public')); // server files from /public folder
app.use(express.json()); // enable reading incoming json data
app.use(express.urlencoded({ extended: true }));

// setup authentication routes
app.use('/api/auth', authRoutes);

const ensureAuth = require('./lib/auth/ensure-auth');

// everything that starts with "/api" below here requires an auth token!
app.use('/api/me', ensureAuth);


// this is /GET request that returns whole list of todos
app.get('/api/rickmorty', async(req, res) => {
    try {
        
        const data = await request.get(`https://rickandmortyapi.com/api/character/?name=${req.query.search}`);

        res.json(data.body);
    }
    catch (err) {
        // handle errors
        console.log(err);
        res.status(500).json({
            error: err.message || err
        });
    }
});

// this endpoint creates a new todo
app.get('/api/me/favorites', async(req, res) => {
    try {
        const myQuery = `
        SELECT * FROM favorites
        WHERE user_id=$1
        `;
        const favorites = client.query(myQuery, [req.userId]
        );

        res.json(favorites.rows);
    }
    catch (err) {
        console.log(err);
        res.status(500).json({
            error: err.message || err
        });
    }
});

app.post('/api/me/favorites', async(req, res) => {
    try {
        
        const newFavorites = client.query(`
        INSERT INTO favorites (character, status, species, user_id)
        values ($1, $2, $3, $4)
        RETURNING *
        `,
        [req.body.character, req.body.status, req.body.species, req.userId]);

        res.json(newFavorites.rows);
    }
    catch (err) {
        console.log(err);
        res.status(500).json({
            error: err.message || err
        });
    }
});

app.delete('/api/me/favorites/:id', async(req, res) => {
    try {
        const myQuery = `
        DELETE * FROM favorites
        WHERE user_id=$1
        RETURNING *
        `;
        const favorites = client.query(myQuery, [req.params.id]
        );

        res.json(favorites.rows);
    }
    catch (err) {
        console.log(err);
        res.status(500).json({
            error: err.message || err
        });
    }
});

// Start the server
app.listen(process.env.PORT, () => {
    console.log('server running on PORT', process.env.PORT);
});