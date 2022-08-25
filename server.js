const express = require('express');
const app = express();
const server = require('http').Server(app);
const { v4: uuidv4} = require('uuid');
const io = require('socket.io')(server);
const {ExpressPeerServer} = require('peer');
const peerServer = ExpressPeerServer(server, {
    debug: true
});
app.use(express.static('public'));
app.use('/peerjs', peerServer);

app.set('view engine', 'ejs');


let user = {
    id: 1,
    name : "Jonathan",
    rooms : ["1",3],

}

app.get('/', (req, res) => {
    res.redirect(`/${uuidv4()}`);
});

app.get('/room/:room', (req, res) => {
    // check if user contains the room
    if(user.rooms.includes(req.params.room)){

        res.render('room', { roomId: req.param.room })
        io.on('connection', socket => {
            socket.on('join-room', (roomId, userId) => {

                socket.join(roomId);
                socket.to(roomId).broadcast.emit('user-connected', userId);
                socket.on('message', message => {
                    io.to(roomId).emit('createMessage', message)
                })
            })
        })
    } else {
        res.redirect('/error');
    }
});







server.listen(process.env.PORT || 3000);