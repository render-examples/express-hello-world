const Doctor = require('../models/doctor.model');

const getDoctors = async (req, res) => {
    let doctors = await Doctor.find().populate('primaryFacility');

    if(doctors) {
        res.status(200).json(doctors);
    } else {
        res.status(400).json()
    }
}

module.exports = {
    getDoctors,
}