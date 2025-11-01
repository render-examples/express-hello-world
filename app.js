import express from "express";
import twilio from "twilio";

const app = express();

// Twilio schickt Form-Daten bei einem Anruf (POST)
app.use(express.urlencoded({ extended: true }));

// Diese Route wird von Twilio angerufen, wenn jemand die Praxis anruft
app.post("/", (req, res) => {
  // TwiML = was Twilio dem Anrufer vorspielen / sagen soll
  const twiml = new twilio.twiml.VoiceResponse();

  // Ansage für eure Praxis
  twiml.say(
    {
      voice: "Polly.Vicki",   // weibliche Stimme
      language: "de-DE"       // deutsch
    },
    "Willkommen in der hausärztlichen Praxis Dr. Müller. "
    + "Bitte nennen Sie kurz Ihren Namen, Ihr Anliegen, und ob es dringend ist. "
    + "Wir rufen Sie schnellstmöglich zurück. Vielen Dank."
  );

  // Twilio erwartet XML als Antwort
  res.type("text/xml");
  res.send(twiml.toString());
});

// Server starten
const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`PraxisAssist-KI Server läuft auf Port ${port}`);
});
