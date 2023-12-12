const express = require('express');
const router = express.Router();
const convidados = require('../services/convidados');


// GET por id
router.get('/:id(\\d+)/', function(req, res, next) {
  try {
    const { id } = req.params;
    const convidadosList = convidados.getConvidadoById(id);
    convidadosList.then(
        (resultado) => res.json(resultado),
        (erro) => console.error(erro)
    );
  } catch(err) {
    console.error(`Error`, err.message);
    next(err);
  }
});

// GET por nome
router.get('/:nomeCompleto', function(req, res, next) {
  try {
    const { nomeCompleto } = req.params;
    const convidadosList = convidados.getConvidadoByNome(nomeCompleto);
    convidadosList.then(
        (resultado) => res.json(resultado),
        (erro) => console.error(erro)
    );
  } catch(err) {
    console.error(`Error`, err.message);
    next(err);
  }
});

// POST aceita convite
router.post('/accept/:id(\\d+)/', function(req, res, next) {
  try {
    const { id } = req.params;
    const convidadosList = convidados.acceptInvite(id);
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