const express = require('express');
const cooperativeDoctorsController = require('../controllers/cooperative-doctors.controller');
const router = express.Router();

router.get('/', cooperativeDoctorsController.getCooperativeDoctors);
router.get('/:id', cooperativeDoctorsController.getCooperativeDoctor);

module.exports = router