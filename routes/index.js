// Full Documentation - https://docs.turbo360.co
const express = require('express')
const router = express.Router()

const profiles = {
  epatel: {
    image: '/images/emil.jpeg',
    name: 'Emil Patel',
    username: 'epatel',
    company: 'EP',
    languages: ['German', 'English']
  },

  jpatel: {
    image: '/images/jordan.jpeg',
    name: 'Jordan Patel',
    username: 'jpatel',
    company: 'Logical Web Design',
    languages: ['English', 'Spanish', 'German']
  }
}

/*  This is the home route. It renders the index.mustache page from the views directory.
  Data is rendered using the Mustache templating engine. For more
  information, view here: https://mustache.github.io/#demo */
router.get('/', (req, res) => {
  res.render('index', { text: 'This is the dynamic data. Open index.js from the routes directory to see.' })
})

// All profiles
router.get('/profiles', (req, res) => {
  const keys = Object.keys(profiles)
  const list = []
  keys.forEach(key => {
    list.push(profiles[key])
  })

  const data = {
    profiles: list,
    timestamp: req.timestamp
  }
  res.render('profiles', data)
})

// Add new profile POST request
router.post('/addprofile', (req,res) => {
  const body = req.body
  body['languages'] = req.body.languages.split(',')

  profiles[body.username] = body
  res.redirect('/profile/'+body.username)

  res.json({
    confirmation: 'success',
    data: body
  })
})

router.get('/query', (req, res) => {
  const name = req.query.name
  const occupation = req.query.occupation

  const data = {
    name: name,
    occupation: occupation
  }

  res.render('profile', data)
})

router.get('/:path', (req, res) => {
  const path = req.params.path

  res.json({
    data:path
  })
})

// Profile page
router.get('/:profile/:username', (req, res) => {
  const profile = req.params.profile
  const username = req.params.username
  const currentProfile = profiles[username]

  if (currentProfile == null) {
    res.json({
      confirmation: 'fail',
      message: `Profile ${username} not found`
    })
  }

  currentProfile.timestamp = req.timestamp

  res.render('profile', currentProfile)
})


module.exports = router
