const Doctor = require('../models/doctor.model');

const getDoctors = async (req, res) => {
    let doctors = await Doctor.find().populate('primaryFacility');

    if(doctors) {
        res.status(200).json(doctors);
    } else {
        res.status(400).json()
    }
}

const getDoctor = async (req, res) => {
    let doctor = await Doctor.findById(req.params.id).populate('primaryFacility');

    if(doctor) {
        res.status(200).json(doctor);
    } else {
        res.status(400).json()
    }
}

module.exports = {
    getDoctors, getDoctor
}