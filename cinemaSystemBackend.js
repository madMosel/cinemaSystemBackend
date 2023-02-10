let cfg = require('./config.json')

let express = require('express');
let cors = require('cors')
const app = express();
app.use(express.static('public')); // host public folder
app.use(cors()); // allow all origins -> Access-Control-Allow-Origin: *
const pool = require('./pool.js');
let bodyParser = require('body-parser');
app.use(bodyParser.json()); // support json encoded bodies

//following two are needed for socket.io
const http = require('http')
const io = require('socket.io')(http)

const checkAuth = require('./check_auth');
const loginRoutes = require('./login');
//here the login mehtod from login.js is called
app.use("/login", loginRoutes);

// DEFAULT PAGE - NO AUTH NECCESARY
app.get("/", (req, res) => {
    res.status(200).send("Cinema system backend");
});


//SIGN UP (login is in login.js)
app.post("/sign-up", function (request, response) {
    let username = request.body.username;
    let password = request.body.password;
    console.log("login: " + username + " " + password)

    // issue query (returns promise)
    pool.query("select * from users where username = $1::text", [username])
        .then(results => {
            //no match -> username is not used, OK
            if (results.rows.length > 0) response.status(409).send("Username already exists!");

            pool.query("insert into users (username, type, password) values ($1::text, 'USER', $2::text)", [username, password])
                .then(results => {
                    response.status(200).json({
                        "message": "sign up successful",
                    })
                    response.send("welcome " + username);
                })
                .catch(error => { })
        })
        .catch(error => {
            // handle error accessing db
            console.log("server error during /sign-up.querry()")
            console.log(error)
            response.status(500).send("server error")
        })
})


// app.post("/logout", checkAuth, function(request, response) {
//     console.log("logout function:")
//     console.log(request)

// })

/* 
 *    When buying tickets the app needs realtime-support to 
 *    see live reservation of seets. There is done a registration
 *    to get live updates to a theather with a shedule as key.
 *    If a client reserves or buys a seat of a shedule, all clients
 *    gets updated
 * 
 *    Client side
 *    1. get current state of the theater (seat status - key is a schedule)
 *    2. sign up to live updates - get socket
 *    3. on leaving page detach and relase socket
 * 
 *    Server side
 *    1. calculate theater state and prepare socket
 *    2. on change reagarding theater and schedule update all clients
 *    3. when no clients release model
 */

async function getHallState()




//REQUEST PRODUCT LIST FROM DATABASE AND SEND TO CLIENT
app.get("/products", checkAuth, function (request, response) {
    pool.query('SELECT * from users')
        .then(database_result => {
            console.log(database_result)
            console.log(database_result.rows[0].text)
            response.status(200).send(database_result.rows)
        })
        .catch(error => {
            console.log(error)
            response.send(error)
        })
})



//REQUEST SINGLE PRODUCT DATA FROM DATABASE AND SEND TO CLIENT
app.get('/products/?*', checkAuth, function (request, response) {
    console.log("GET /products/?* callback")
    let pathname = url.parse(request.url).pathname
    let product_id = pathname.replace("/products/", "")
    console.log(product_id)

    pool.query('SELECT * from products where id = $1::text', [product_id])
        .then(database_result => {
            console.log(database_result)
            console.log(database_result.rows[0].text)
            response.send(database_result.rows)
        })
        .catch(error => {
            console.log(error)
            response.send("no such product")
        })
})


// TODO: the rest of the route handlers are mostly the same as in EX3 with important differences


let port = 3000;
app.listen(port);
console.log("Server running at: http://localhost:" + port);
