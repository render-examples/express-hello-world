const Hospital = require('../models/hospital.model');
const opts = { toJSON: { virtuals: true } };

const getHospitals = async (req, res) => {
    let hospitals = await Hospital.find();

    if(hospitals) {
        res.status(200).json(hospitals);
    } else {
        res.status(400).json()
    }
}

module.exports = {
    getHospitals,
}