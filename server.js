// Load Environment Variables from the .env file
require('dotenv').config();

// Application Dependencies
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
// Database Client
const client = require('./lib/client');
// Services
const quotesApi = require('./lib/quotes-api');
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
        `, [user.email, hash, user.displayName]);
        return result.rows[0];
    }
});

// Application Setup
const app = express();
const PORT = process.env.PORT || 3000;
app.use(morgan('dev')); // http logging
app.use(cors()); // enable CORS request
app.use(express.static('public')); // server files from /public folder
app.use(express.json()); // enable reading incoming json data
app.use(express.urlencoded({ extended: true }));

// setup authentication routes
app.use('/api/auth', authRoutes);

const ensureAuth = require('./lib/auth/ensure-auth');

// everything that starts with "/api" below here requires an auth token!
app.use('/api', ensureAuth);

/ *** TODOS ***
// this is /GET request that returns whole list of todos
app.get('/api/char', async(req, res) => {
    
    const data = await request.get('https://rickandmortyapi.com/api/character/${req.query.search}')
    try {
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
app.post('/api/todos', async(req, res) => {
    try {
        // the user input lives is req.body.task

        console.log('|||||||', req.userId);
        // use req.body.task to build a sql query to add a new todo
        // we also return the new todo

        const result = await client.query(`
            insert into todos (task, complete, user_id)
            values ($1, false, $2)
            returning *;
        `,
        [req.body.task, req.userId]);

        // respond to the client request with the newly created todo
        res.json(result.rows[0]);
    }
    catch (err) {
        console.log(err);
        res.status(500).json({
            error: err.message || err
        });
    }
});

// this route has a body with a complete property and an id in the params
app.put('/api/todos/:id', async(req, res) => {
    try {
        const result = await client.query(`
        update todos
        set complete=$1
        where id =${req.params.id}
        returning *;
        `, [req.body.complete]);

        res.json(result.rows[0]);
    }
    catch (err) {
        console.log(err);
        res.status(500).json({
            error: err.message || err
        });
    }
});

app.delete('/api/todos/:id', async(req, res) => {
    // get the id that was passed in the route:

    try {
        const result = await client.query(`
            delete from todos where id=${req.params.id}
            returning *;
        `,); // this array passes to the $1 in the query, sanitizing it to prevent little bobby drop tables

        res.json(result.rows[0]);
    }
    catch (err) {
        console.log(err);
        res.status(500).json({
            error: err.message || err
        });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log('server running on PORT', PORT);
});