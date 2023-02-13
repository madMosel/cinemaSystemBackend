const jwt = require('jsonwebtoken');
const loginModule = require('./login')

checkLogin = (req, res, next) => {
    try {
        console.log(req)
        let token = req.headers.authorization
        let verfied = jwt.verify(token, "secret")
        console.log(verfied)
        if (verfied != undefined) next()
        else res.status(403).json({ message: "Do login first" })
    } catch (error) {
        return res.status(401).json({ message: "Authentication failed" });
    }
};

checkAdmin = (req, res, next) => {
    console.log("checkAdmin()")
    // console.log(req.headers.authorization)
    // for (let v of loginModule.userMap) console.log(v)
    let user = loginModule.userMap.get(req.headers.authorization)
    console.log(user.usertype)
    if (user != undefined && user.usertype === "ADMIN") next()
    else res.status(403).json({ message: "Page requires admin login" })
}

module.exports = { checkLogin, checkAdmin }