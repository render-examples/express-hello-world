const express = require('express');
const hospitalsContoller = require('../controllers/hospitals.controller')
const router = express.Router();

router.get('/', hospitalsContoller.getHospitals);

module.exports = router