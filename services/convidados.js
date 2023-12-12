const dbase = require('../services/db');

function getConvidados() {
    return new Promise((resolve, reject) => {
        dbase.db.all(`SELECT id, nome, sobrenome FROM convidados;`, (error, rows) => {
            if (error) {
                reject(error);
            } else {
                resolve({
                    'data': rows
                });
            }
        });
    });
}

function getConvidadoById(id) {
    return new Promise((resolve, reject) => {
        const params = { $id: id };
        dbase.db.get(`SELECT * FROM convidados WHERE id = $id`, params,
            (error, row) => {
                if (error) {
                    reject(error);
                } else {
                    resolve({
                        'data': row
                    });
                }
        });
    });
}

function getConvidadoByNome(paramNome) {
    return new Promise((resolve, reject) => {
        const paramReceive = paramNome.split('_');
        const params = {
            $nome: paramReceive.shift(),
            $sobrenome: paramReceive.join(' ') || ''
        };

        dbase.db.get(`SELECT * FROM convidados WHERE nome = $nome AND sobrenome LIKE $sobrenome`,
            params,
            (error, row) => {
                if (error) {
                    reject(error);
                } else {
                    resolve({
                        'data': row
                    });
                }
        });
    });
}

function findConvidadosByNome(paramNome) {
    return new Promise((resolve, reject) => {
        const paramReceive = paramNome.split('_');
        const params = {
            $nome: paramReceive.shift() + '%',
            $sobrenome: paramReceive.join(' ') || ''
        };

        dbase.db.all(`SELECT id, nome, sobrenome FROM convidados WHERE (nome LIKE $nome OR sobrenome LIKE $sobrenome) AND status = '' LIMIT 4`,
            params,
            (error, row) => {
                if (error) {
                    reject(error);
                } else {
                    resolve({
                        'data': row
                    });
                }
        });
    });
}

function acceptInvite(id) {
    return new Promise((resolve, reject) => {
        const params = { $id: id };
        dbase.db.run(`UPDATE convidados SET status = 'S' WHERE id = $id;`,
            params,
            (error, row) => {
                if (error) {
                    reject(error);
                } else {
                    resolve({
                        'data': row
                    });
                }
        });
    });
}

module.exports = {
    getConvidados,
    getConvidadoById,
    getConvidadoByNome,
    findConvidadosByNome,
    acceptInvite
}