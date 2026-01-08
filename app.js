const express = require('express');
const dotenv = require('dotenv');
const { createCalendarClient, createBookingEvent } = require('./lib/calendar');
const { createVoiceRouter } = require('./lib/voiceFlow');

dotenv.config();

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.get('/healthz', (req, res) => {
  res.json({ status: 'ok' });
});

app.use(
  createVoiceRouter({
    createCalendarClient,
    createBookingEvent
  })
);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
