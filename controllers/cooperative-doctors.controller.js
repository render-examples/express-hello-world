const CooperativeDoctor = require('../models/cooperative-doctor.model');

const getCooperativeDoctors = async (req, res) => {
    let doctors = await CooperativeDoctor.find().populate('primaryFacility');

    if(doctors) {
        res.status(200).json(doctors);
    } else {
        res.status(400).json()
    }
}

const getCooperativeDoctor = async (req, res) => {
    let doctor = await CooperativeDoctor.findById(req.params.id).populate('primaryFacility');

    if(doctor) {
        res.status(200).json(doctor);
    } else {
        res.status(400).json()
    }
}

module.exports = {
    getCooperativeDoctors, getCooperativeDoctor
}