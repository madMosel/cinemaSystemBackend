let cfg = require('./config.json')
const jwt = require('jsonwebtoken');

// EX4 TODO:
// - verify token using jwt_key of "secret"
// - set req.userData to the user information stored in the token's payload
module.exports = (req, res, next) => {
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
