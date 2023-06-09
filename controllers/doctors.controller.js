const Doctor = require('../models/doctor.model');
const opts = { toJSON: { virtuals: true } };

const getDoctors = async (req, res) => {
    let doctors = await Doctor.find();

    if(doctors) {
        res.status(200).json(doctors);
    } else {
        res.status(400).json()
    }
}

module.exports = {
    getDoctors,
}