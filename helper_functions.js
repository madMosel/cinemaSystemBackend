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
    console.log("[" + beginString + ", " + endString + "]")
    return "[" + beginString + ", " + endString + "]"
}

module.exports = { getScheduleTimeStringFromScheduleDateTime }