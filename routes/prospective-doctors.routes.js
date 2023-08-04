const express = require('express');
const prospectiveDoctorsContoller = require('../controllers/prospective-doctors.controller');
const router = express.Router();

router.get('/', prospectiveDoctorsContoller.getProspectiveDoctors);
router.get('/:id', prospectiveDoctorsContoller.getProspectiveDoctor);

module.exports = router