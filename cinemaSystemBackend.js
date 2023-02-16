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
const loginModule = require('./login');
//here the login mehtod from login.js is called
app.use("/login", loginModule.router);


const helpers = require('./helper_functions');
const { pathToFileURL } = require('url');

// DEFAULT PAGE - NO AUTH NECCESARY
app.get("/", (req, res) => {
    res.status(200).send("Cinema system backend");
});


//SIGN UP (login is in login.js)
app.post("/sign-up", function (request, response) {
    let username = request.body.username;
    let password = request.body.password;
    console.log("signing up : login: " + username + " " + password)

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

        console.log("updating and inserting theaters...")
        let hallIdMap = new Map()
        for (let h of changes.halls) {
            if (h.hallId > 0) {
                await transactionClient.query(`update theaters set (name, numrows, numcols, dolby, d3, d4) = 
                                         ($1, $2, $3, $4, $5, $6) where id = $7`,
                    [h.hallName, h.seats.length, h.seats[0].length, h.dolby, h.d3, h.d4, h.hallId])
                await transactionClient.query("delete from seats where theaterid = $1", [h.hallId])
                console.log("updated theater " + h.hallId)
                hallIdMap.set(h.hallId, h.hallId)
            }
            else if (h.hallId == 0) throw new Error("HallId 0!")
            else {
                let newHallId = (await transactionClient.query(`insert into theaters 
                                                                (numrows, numcols, name, dolby, d3, d4) 
                                                                values ($1, $2, $3, $4, $5, $6) returning id;`,
                    [h.seats.length, h.seats[0].length, h.hallName, h.dolby, h.d3, h.d4]
                )).rows[0].id



                console.log("new theater id: " + newHallId)
                hallIdMap.set(h.hallId, newHallId)
            }
            let countseats = 0;
            for (let row of h.seats) {
                for (let seat of row) {
                    await transactionClient.query(`insert into seats (theaterid, nr, category, state)
                    values ($1,$2,$3,$4)`,
                        [hallIdMap.get(h.hallId), countseats++, seat.category, seat.state])
                }
            }
        }

        console.log("inserting new movies...")
        let movieIdMap = new Map()
        for (let m of changes.movies) {
            if (m.movieId > 0) {
                await transactionClient.query(`update movies  set (title, age, duration, posterurl, description, price) = 
                    ($1, $2, $3, $4, $5, $6) where id = $7`, [m.movieTitle, m.age, m.duration, (m.poster ? m.poster : 'default'), m.description, m.price, m.movieId])
            }
            else if (m.movieId == 0) throw new Error("Movie positive or 0!")
            else {
                let newMovieId = await transactionClient.query(`insert into movies (title, age, duration, posterurl, description, price) 
                values ($1, $2, $3, $4, $5, $6) returning id`,
                    [m.movieTitle, m.age, m.duration, (m.poster ? m.poster : 'default'), m.description, m.price])
                console.log("created movie " + m.movieTitle)
                movieIdMap.set(m.movieId, newMovieId.rows[0].id)
            }
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
        console.log(e)
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
            Promise.resolve(theatersPromise).then(() => {
                let s = new classes.Seat(row.nr, row.category, row.state)
                sRow.push(s)
                if (sRow.length === geometryMap.get(row.theaterid)) {
                    hallMap.get(row.theaterid).seats.push(sRow)
                    sRow = []
                }
            })
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
        Promise.resolve(moviesPromise).then(() => {
            for (let row of db_result.rows) {
                movieMap.get(row.movieid).ratings.push(new classes.Rating(row.stars, row.msg, row.username))
            }
        })
    })
    let schedulesPromise = pool.query("select * from schedules").then(db_result => {
        for (let row of db_result.rows) {
            schedules.push(new classes.Schedule(row.movieid, row.theaterid, helpers.parsePeriodToNiceDate(row.period)))
        }
    })

    Promise.all([theatersPromise, seatsPromise, moviesPromise, raitingsPromise, schedulesPromise]).then(() => {
        response.status(200).send({
            halls: halls,
            movies: movies,
            schedules: schedules
        })
    }).catch(e => {
        console.log(e)
        response.status(500).send("error during db operation!")
    })
})


app.post("/hall-state", userService.checkLogin, function (request, response) {
    console.log("/hall-state")
    let schedule = JSON.parse(request.headers.schedule)
    let dt = schedule.dateTime
    let timestamp = dt.year + "-" + dt.month + "-" + dt.day + " " + dt.hour + ":" + dt.minute
    let ocupiedSeats = new Set()
    let ticketsPromise = pool.query("select * from tickets where theaterid = $1 and movieid = $2 and period @> $3::timestamp",
        [schedule.hallId, schedule.movieId, timestamp])
        .then(db_result => {
            console.log(db_result.rows)
            for (let row of db_result.rows) ocupiedSeats.add(row.seatnr)
        })

    let hall, numcols;
    let hallPromise = pool.query("select * from theaters where id = $1", [schedule.hallId]).then(db_result => {
        let h = db_result.rows[0]
        hall = new classes.CinemaHall(h.id, h.name, [], h.dolby, h.d3, h.d4)
        numcols = h.numcols
    })

    let seatsPromise = pool.query("select * from seats where theaterid = $1 order by nr asc", [schedule.hallId]).then(db_result => {
        let sRow = []
        Promise.resolve(hallPromise).then(() => {
            for (let row of db_result.rows) {
                sRow.push(new classes.Seat(row.nr, row.category, row.state))
                if (sRow.length === numcols) {
                    hall.seats.push(sRow)
                    sRow = []
                }
            }
        })
    })

    Promise.all([ticketsPromise, hallPromise, seatsPromise]).then(() => {
        for (let row of hall.seats) {
            for (let seat of row) {
                if (ocupiedSeats.has(seat.id)) seat.state = "BOOKED"
            }
        }
        response.status(200).send(hall)
    }).catch(e => {
        console.log(e)
        response.status(500).send("error during calculating hall state")
    })
})


app.post("/buy-tickets", userService.checkLogin, async function (request, response) {
    console.log("/buy-tickets")
    let tickets = JSON.parse(request.headers.tickets)

    console.log(tickets)

    let transactionClient = await pool.connect()
    try {
        await transactionClient.query('BEGIN')

        let duration
        await transactionClient.query("select duration from movies where id = $1", [tickets[0].schedule.movieId])
            .then(db_result => duration = db_result.rows[0].duration)
        console.log(helpers.getScheduleTimeStringFromScheduleDateTime(tickets[0].schedule.dateTime, duration))
        for (let t of tickets) {
            await transactionClient.query(`insert into tickets (theaterid, movieid, period, seatnr, username) 
                        values ($1, $2, $3, $4, $5)`,
                [t.schedule.hallId, t.schedule.movieId,
                helpers.getScheduleTimeStringFromScheduleDateTime(t.schedule.dateTime, duration),
                t.seatId, t.username])
        }

        console.log("end transaction. committing...")
        await transactionClient.query('COMMIT')
        response.status(200).send()
    } catch (e) {
        console.log("errors during tickets transaction, rolling back...")
        console.log(e)
        await transactionClient.query('ROLLBACK')
        response.status(500).send()
    } finally {
        transactionClient.release()
    }
})

app.get("/tickets", userService.checkLogin, function (request, response) {
    console.log("/tickets")
    let username = loginModule.userMap.get(request.headers.authorization).username
    username = username.trim()

    pool.query("select * from tickets where username = $1::text", [username]).then(db_result => {
        let tickets = []
        for (let row of db_result.rows) {
            tickets.push(
                new classes.Ticket(
                    new classes.Schedule(row.movieid, row.theaterid, helpers.parsePeriodToNiceDate(row.period)),
                    username, row.seatnr
                ))
        }
        response.status(200).send(tickets)
    }).catch(e => {
        console.log(e)
        response.status(500).send("error while loading tickets!")
    })
})

app.post("/rate", userService.checkLogin, async function (request, response) {
    console.log("/rate")
    try {
        let username = loginModule.userMap.get(request.headers.authorization).username
        username = username.trim()
        let rating = JSON.parse(request.headers.rating)
        let movieId = JSON.parse(request.headers.movieId)
    
        let existingRating = undefined
        await pool.query("select * from ratings where username = $1 and movieid = $2", [username, rating.movieId]).then(db_result => {
            for (let row of db_result.rows) existingRating = new classes.Rating(row.stars, row.msg, username)
        })
        if (!existingRating) {
            await pool.query("insert into ratings (stars, movieid, username) values ($1, $2, $3)", [rating.stars, movieId, username])
            existingRating = rating
        }
        if (rating.description) {
            await pool.query("update ratings set (stars, msg) = ($1, $2) where movieid = $3 and username = $4",
                [rating.stars, rating.description, movieId, username])
        } else {
            await pool.query("update ratings set (stars, msg) = ($1, NULL) where movieid = $2 and username = $3",
                [rating.stars, movieId, username])
        }
        response.status(200).send()
        console.log("rated movie " + rating.movieId)
    } catch (e) {
        console.log(e)
        response.status(500).send("error while rating")
    }
})

let port = 3000;
app.listen(port);
console.log("Server running at: http://localhost:" + port);