const express = require('express');
const doctorsController = require('../controllers/doctors.controller');
const router = express.Router();

router.get('/', doctorsController.getDoctors);
router.get('/:id', doctorsController.getDoctor);

module.exports = router