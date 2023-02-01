let cfg = require('./config.json')
const express = require('express');
const router = express.Router();
const pool = require('./pool.js');

const jwt = require('jsonwebtoken');

// login route creating/returning a token on successful login
router.post('/', (request, response) => {
    console.log(request.body)

    let username = request.body.username;
    let password = request.body.password;

    console.log ("login: "+username + " " + password)

    // issue query (returns promise)
    pool.query("select * from users where username = $1::text and password = $2::text", [username, password])
        .then(results => {

            // handle no match (login failed)
            if (results.rows.length < 1) response.status(201).send("login failed");


            // everything is ok
            let resultUser = results.rows[0]; //u can use =result.rows[o].login (login is the  name of the column in the DB)

            const token = jwt.sign(resultUser,'secret')
            /* form the token with userData (accessible when decoding token), jwtkey, expiry time */

            response.status(200).json({
                "message": "login successful",
                login: resultUser.login,
                token: token
            });

        })
        .catch(error => {
            // handle error accessing db
            console.log("server error during /login.querry()")
            console.log(error)
            response.status(500).send("server error")
        })

});

module.exports = router;
