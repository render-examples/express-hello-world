// Full Documentation - https://docs.turbo360.co
const express = require('express')
const router = express.Router()

/*  This is a sample API route. */

router.get('/:resource', (req, res) => {
  res.json({
    confirmation: 'success',
    resource: req.params.resource,
    query: req.query // from the url query string
  })
})

router.get('/:resource/:id', (req, res) => {
  res.json({
    confirmation: 'success',
    resource: req.params.resource,
    id: req.params.id,
    query: req.query // from the url query string
  })
})

module.exports = router
