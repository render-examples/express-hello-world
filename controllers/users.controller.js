const decode = require('jwt-decode');

const getUserPermissions = async (req, res) => {
    let permissions = decode(req.headers.authorization).permissions;

    res.status(200).json(permissions);
}

module.exports = {
    getUserPermissions
}