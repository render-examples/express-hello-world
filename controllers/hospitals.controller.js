const Hospital = require('../models/hospital.model');

const getHospitals = async (req, res) => {
    let hospitals = await Hospital.find();

    if(hospitals) {
        res.status(200).json(hospitals);
    } else {
        res.status(400).json()
    }
}

const getHospital = async (req, res) => {
    let hospital = await Hospital.findById(req.params.id);

    if(hospital) {
        res.status(200).json(hospital);
    } else {
        res.status(400).json()
    }
}

const createHospital = async (req, res) => {
    let hosptial = await Hospital.create(req.body);
    res.status(201).json(hosptial);
}

const updateHospital = async (req, res) => {
    let hosptial = await Hospital.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.status(200).json(hosptial);
}


module.exports = {
    getHospitals, getHospital, createHospital, updateHospital
}