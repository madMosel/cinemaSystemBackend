let cfg = require('./config.json')

let express = require('express');
let cors = require('cors')
const app = express();
app.use(express.static('public')); // host public folder
app.use(cors()); // allow all origins -> Access-Control-Allow-Origin: *
const pool = require('./pool.js');
let bodyParser = require('body-parser');
app.use(bodyParser.json()); // support json encoded bodies

const classes = require('./Classes')

//following two are needed for socket.io
const http = require('http')
const io = require('socket.io')(http)

const userService = require('./user_service');
const loginRoutes = require('./login');
//here the login mehtod from login.js is called
app.use("/login", loginRoutes.router);


const helpers = require('./helper_functions')

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


app.post("/update-database", userService.checkAdmin, async function (request, response) {
    console.log(request.headers.changes)
    let changes = JSON.parse(request.headers.changes)
    console.log("deleting schedules ... ")
    let transactionClient = await pool.connect()
    try {
        await transactionClient.query('BEGIN')
        console.log("deleting schedules ... ")
        for (let ds of changes.deleteSchedules) {
            let duration = await transactionClient.query("select duration from movies where id = $1", [ds.movieId])
            await transactionClient.query(`delete from schedules where
             movieid = $1 and theaterid = $2 and period = $3`,
                [ds.hallId, ds.movieId,
                helpers.getScheduleTimeStringFromScheduleDateTime(ds.dateTime, duration.rows[0].duration)
                ])
            console.log("deleted schedule " + ds)
        }

        console.log("deleting movies ... ")
        for (let dm of changes.deleteMovies) {
            await transactionClient.query("delete from ratings where movieid=$1", [dm.movieId])
            await transactionClient.query(
                `delete from movies where id=$1`, [dm.movieId]
            )
        }

        console.log("deleting halls ... ")
        for (let dh of changes.deleteHalls) {
            await transactionClient.query("delete from seats where theaterid = $1", [dh.hallId])
            await transactionClient.query("delete from theaters where id=$1", [dh.hallId])
        }

        console.log("inserting new theaters...")
        let hallIdMap = new Map()
        for (let h of changes.halls) {
            if (h.hallId >= 0) throw new Error("HallId positive or 0!")
            let newHallId = (await transactionClient.query(`insert into theaters 
            (numrows, numcols, name, dolby, d3, d4) 
            values ($1, $2, $3, $4, $5, $6) returning id;`,
                [h.seats.length, h.seats[0].length, h.hallName, h.dolby, h.d3, h.d4]
            )).rows[0].id

            let countseats = 0;
            for (let row of h.seats) {
                for (let seat of row) {
                    transactionClient.query(`insert into seats (theaterid, nr, category, state)
                        values ($1,$2,$3,$4)`,
                        [newHallId, countseats++, seat.category, seat.state])
                }
            }


            console.log("new theater id: " + newHallId)
            hallIdMap.set(h.hallId, newHallId)
        }

        console.log("inserting new movies...")
        let movieIdMap = new Map()
        for (let m of changes.movies) {
            if (m.movieId >= 0) if (h.hallId >= 0) throw new Error("Movie positive or 0!")
            let newMovieId = await transactionClient.query(`insert into movies (title, age, duration, posterurl, description, price) 
            values ($1, $2, $3, $4, $5, $6) returning id`,
                [m.movieTitle, m.age, m.duration, (m.poster ? m.poster : 'd'), m.description, m.price])
            console.log("created movie " + m.movieTitle)
            movieIdMap.set(m.movieId, newMovieId.rows[0].id)
        }

        console.log("inserting new schedules...")
        for (let s of changes.schedules) {
            let duration
            if (s.movieId < 0) {
                for (let m of changes.movies) if (m.movieId === s.movieId) {
                    duration = m.duration
                    break
                }
            }
            else duration = (await transactionClient.query("select duration from movies where id = $1", [s.movieId])).rows[0].duration
            await transactionClient.query(`insert into schedules (movieId, theaterid, period) 
            values ($1, $2, $3)`, [
                (s.movieId > 0 ? s.movieId : movieIdMap.get(s.movieId)),
                s.hallId > 0 ? s.movieId : hallIdMap.get(s.hallId),
                helpers.getScheduleTimeStringFromScheduleDateTime(s.dateTime, duration)
            ])
            console.log("created schedule")
        }

        console.log("end transaction. committing...")
        await transactionClient.query('COMMIT')
        response.status(200).send()
    } catch (e) {
        console.log("errors during transaction, rolling back...")
        console.log(console.error())
        await transactionClient.query('ROLLBACK')
        response.status(500).send()
    } finally {
        transactionClient.release()
    }

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

// async function getHallState()


//LOAD PUBLIC DATA
app.get("/load-public-data", function (request, response) {
    let halls = [], movies = [], schedules = []
    let hallMap = new Map(), geometryMap = new Map(), movieMap = new Map()
    let theatersPromise = pool.query("select * from theaters").then(db_result => {
        for (let row of db_result.rows) {
            let c = new classes.CinemaHall(row.id, row.name, [], row.dolby, row.d3, row.d4)
            halls.push(c)
            hallMap.set(c.hallId, c)
            geometryMap.set(c.hallId, row.numcols)
        }
    })
    let sRow = []
    let seatsPromise = pool.query("select * from seats order by theaterid asc, nr asc").then(db_result => {
        for (let row of db_result.rows) {
            let s = new classes.Seat(row.nr, row.category, row.state)
            sRow.push(s)
            if (sRow.length === geometryMap.get(row.theaterid)) {
                hallMap.get(row.theaterid).seats.push(sRow)
                sRow = []
            }
        }
    })
    let moviesPromise = pool.query("select * from movies").then(db_result => {
        for (let row of db_result.rows) {
            let m = new classes.Movie(row.id, row.title, row.age, row.duration, row.posterurl, row.description, [], row.price)
            movies.push(m)
            movieMap.set(row.id, m)
        }
    })
    let raitingsPromise = pool.query("select * from ratings").then(db_result => {
        for (let row of db_result.rows) {
            movieMap.get(row.movieid).ratings.push(new classes.Rating(row.stars, row.description))
        }
    })
    let schedulesPromise = pool.query("select * from schedules").then(db_result => {
        for (let row of db_result.rows) {
            schedules.push(new classes.Schedule(row.movieid, row.theaterid, helpers.parsePeriodToNiceDate(row.period)))
        }
    })
    
    Promise.all([theatersPromise, seatsPromise, moviesPromise, raitingsPromise, schedulesPromise]).then(()=>{
        response.status(200).send({
            halls: halls,
            movies: movies,
            schedules: schedules
        })
    }).catch (e => {
        console.log(e)
        response.status(500).send("error during db operation!")
    })
})


//REQUEST PRODUCT LIST FROM DATABASE AND SEND TO CLIENT
app.get("/products", userService.checkLogin, function (request, response) {
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
app.get('/products/?*', userService.checkLogin, function (request, response) {
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