const express = require("express");
const app = express();

app.use(express.urlencoded({ extended: true }));

app.post("/twilio/voice/incoming", (req, res) => {
  const response = `
<Response>
  <Say voice="Polly.Joanna">
    Good morning. You've reached MJTM Global Enterprises.
    How may I help you today?
  </Say>
</Response>
  `;

  res.type("text/xml");
  res.send(response);
});

const port = process.env.PORT || 10000;
app.listen(port, () => {
  console.log("Voice Bridge running on port " + port);
});
