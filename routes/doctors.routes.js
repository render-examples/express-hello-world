const express = require('express');
const doctorsController = require('../controllers/doctors.controller');
const router = express.Router();

router.get('/');

module.exports = router