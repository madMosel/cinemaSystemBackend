
class Seat {
    constructor(id, category, state) {}
}
const seatCategory = ["Normal", "Premium", "Handicap"]
const seatStates = ["FREE", "RESERVED", "BOOKED"]


class CinemaHall {
    constructor(
        hallId,
        hallName,
        seats,
        dolby,
        d3,
        d4
    ) {

    }
}

class Movie {
    constructor(
        movieId,
        movieTitle,
        age,
        duration,
        poster, //url of pic
        description,
        ratings,
        price
    ) {

    }
}


class Rating {
    constructor(
        stars,
        description
    ) { }
}


class LocalChanges {
    constructor(
        halls,
        movies,
        schedules,
        deleteHalls,
        deleteMovies,
        deleteSchedules,
        newHallCounter,
        newMovieCounter
    ) {}
}



class NiceDate {
    constructor(
        year,
        month,
        day,
        hour,
        minute,
    ) {}
}


function compareNiceDatesOnTime(a, b) {
    if (!(a instanceof NiceDate) || !(b instanceof NiceDate)) {
        throw console.error("compareNiceDatesOnTime a or b not instancof NiceDate!");
    }
    let diff
    if ((diff = a.year - b.year) != 0) return diff
    if ((diff = a.month - b.month) != 0) return diff
    if ((diff = a.day - b.day) != 0) return diff
    if ((diff = a.hour - b.hour) != 0) return diff
    if ((diff = a.minute - b.minute) != 0) return diff
    return 0
}

function compeareNiceDatesOnEquality(a, b) {
    if (!(a instanceof NiceDate) || !(b instanceof NiceDate)) {
        throw console.error("compareNiceDatesOnEquality a or b not instancof NiceDate!");
    }
    return a.year == b.year
        && a.month == b.month
        && a.day == b.day
        && a.hour == b.hour
        && a.minute == b.minute
}



class Schedule {
    constructor(
        movieId,
        hallId,
        dateTime
    ) {}
}

/**
 * compares two Schedules
 * 
 * @param a schedule a
 * @param b schedule b
 * @returns true if equal else false
 */
function compareSchedules(a, b) {
    if (!(a instanceof Schedule) || !(b instanceof Schedule)) {
        throw console.error("compareSchedules a or b not instancof Schedule!");
    }
    return a.hallId == b.hallId && a.movieId == b.movieId
        && compeareNiceDatesOnEquality(a.dateTime, b.dateTime)
}

class Login {
    username
    usertype
    constructor (
        username,
        usertype
    ) {
        this.username = username
        this.usertype = usertype
    }
}

const usertypes = ["ADMIN", "USER"]

class Ticket {
    constructor (
        schedule,
        username,
        seatId
    ) {}
}

module.exports = {Login}