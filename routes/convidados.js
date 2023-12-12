const express = require('express');
const router = express.Router();
const convidados = require('../services/convidados');

router.get('/', function(req, res, next) {
  try {
    const convidadosList = convidados.getConvidados();
    convidadosList.then(
        (resultado) => res.json(resultado),
        (erro) => console.error(erro)
    );
  } catch(err) {
    console.error(`Error`, err.message);
    next(err);
  }
});

router.get('/buscar/:busca', function(req, res, next) {
  try {
    const { busca:nome } = req.params;
    const convidadosList = convidados.findConvidadosByNome(nome);
    convidadosList.then(
        (resultado) => res.json(resultado),
        (erro) => console.error(erro)
    );
  } catch(err) {
    console.error(`Error`, err.message);
    next(err);
  }
});


// /* POST quote */
// router.post('/', function(req, res, next) {
//   try {
//     res.json(convidados.create(req.body));
//   } catch(err) {
//     console.error(`Error while adding quotes `, err.message);
//     next(err);
//   }
// });

module.exports = router;