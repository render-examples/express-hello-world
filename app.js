const express = require("express");
const app = express();
const port = process.env.PORT || 3001;
const convidadoRouter = require('./routes/convidado');
const convidadosRouter = require('./routes/convidados');

app.use(express.json());

app.get('/', (req, res) => {
  res.json({message: 'alive'});
});

app.use('/convidado', convidadoRouter);
app.use('/convidados', convidadosRouter);

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
