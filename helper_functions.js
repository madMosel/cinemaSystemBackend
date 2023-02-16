const { NiceDate } = require("./Classes")

function addMinutes(datetime, mintues) {
    let date = new Date(datetime)
    date.setMinutes(date.getMinutes() + mintues)
    return date
}

function getScheduleTimeStringFromScheduleDateTime(dateTime, minutes) {
    let beginString = dateTime.year + "-" + dateTime.month + "-" + dateTime.day + " " + dateTime.hour + ":" + dateTime.minute
    let begin = new Date(beginString)
    let end = addMinutes(begin, minutes)
    let endString = end.getFullYear() + "-" + (end.getMonth() + 1) + "-" + end.getDate()
        + " " + end.getHours() + ":" + end.getMinutes()
    return "[" + beginString + ", " + endString + "]"
}

function parsePeriodToNiceDate(period) {
    let timestrings = JSON.parse(period)
    let start = new Date(timestrings[0])
    // let end = new Date(timestrings[1])
    // let duration = parseInt((end - start / (1000 * 60)))
    return new NiceDate(start.getFullYear(), start.getMonth() + 1, start.getDate(), start.getHours(), start.getMinutes())
}

module.exports = { getScheduleTimeStringFromScheduleDateTime, parsePeriodToNiceDate }