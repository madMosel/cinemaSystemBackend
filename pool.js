const { Pool } = require('pg');

let cfg = require('./config.json')

let pool = new Pool({
    host: cfg.database.host,
    user: cfg.database.user,
    password: cfg.database.password,
    database: cfg.database.db
});


//testqeurry to see if DB is active, prints name of active DB on console
pool.query('SELECT current_database()')
    .then(database_result => {
        // console.log(database_result)
        console.log(database_result.rows[0])
    })
    .catch(error => {
        console.log(error)
    })

module.exports = pool;