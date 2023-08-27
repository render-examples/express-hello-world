const ProspectiveDoctor = require('../models/prospective-doctor.model');

const getProspectiveDoctors = async (req, res) => {
    let doctors = await ProspectiveDoctor.find().populate('primaryFacility');

    if(doctors) {
        res.status(200).json(doctors);
    } else {
        res.status(400).json()
    }
}

const getProspectiveDoctor = async (req, res) => {
    let doctor = await ProspectiveDoctor.findById(req.params.id).populate('primaryFacility');

    if(doctor) {
        res.status(200).json(doctor);
    } else {
        res.status(400).json()
    }
}

const createProspectiveDoctor = async (req, res) => {
    let doctor = await ProspectiveDoctor.create(req.body);
    res.status(201).json(doctor);
}

const updateProspectiveDoctor = async (req, res) => {
    let doctor = await ProspectiveDoctor.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.status(200).json(doctor);
}

module.exports = {
    getProspectiveDoctors, getProspectiveDoctor, createProspectiveDoctor, updateProspectiveDoctor
}