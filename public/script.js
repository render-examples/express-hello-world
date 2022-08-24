const socket = io('/');
const videoGrid = document.getElementById('video-grid');
const myVideo = document.createElement('video');
myVideo.muted = true;

var peer = new Peer(undefined, {
    path: '/peerjs',
    host: '/',
    port: '443'
});

let myVideoStream;

const addVideoStream = (video, stream) => {
    video.srcObject = stream;
    video.addEventListener('loadedmetadata', () => {
        video.play();
    })
    videoGrid.append(video);
};

const connectToNewUser = (userId, stream) => {
    const call = peer.call(userId, stream);
    const video = document.createElement('video');
    call.on('stream', userVideoStream => {
        addVideoStream(video, userVideoStream);
    })
}

const scrollToBottom = () => {
    let d = $('main_chat_window');
    d.scrollTop(d.prop("scrollHeight"));
}
const setMuteButton = () => {
    const html = `
    <i class="fas fa-microphone"></i>
    <span>Mute</span>`
    $('.main_mute_button').html(html);
}

const setUnmuteButton = () => {
    const html = `
    <i class="unmute fas fa-microphone-slash"></i>
    <span>Ummte</span>`
    $('.main_mute_button').html(html);
}

const muteUnmute = () => {
    const enabled = myVideoStream.getAudioTracks()[0].enabled;
    if(enabled){
        myVideoStream.getAudioTracks()[0].enabled = false;
        setUnmuteButton();
    }
    else {
        setMuteButton();
        myVideoStream.getAudioTracks()[0].enabled = true;
    }

    
}

navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
}).then(stream => {
    myVideoStream = stream;
    addVideoStream(myVideo, stream);

    peer.on('call', call => {
        call.answer(stream)
        const video = document.createElement('video')
        call.on('stream', userVideoStream => {
            addVideoStream(video, userVideoStream)
        })
    })

    socket.on('user-connected', (userId) => {
        connectToNewUser(userId, stream);
    })

    

})

peer.on('open', id => {
    socket.emit('join-room', ROOM_ID, id);
});

let text = $('input');
    $('html').keydown(e => {
        if (e.which == 13 && text.val().length !== 0) {
            socket.emit('message', text.val());
            console.log(text.val());
            text.val('')
        }
    });

    socket.on('createMessage', message => {
        $('ul').append(`<li class="message"><b>user</b><br />${message}</li>`)
        scrollToBottom();
    })

const setPlayVideo = () => {
    const html = `
    <i class="stop fas fa-video-slash"></i>
    <span>PlayVideo</span>`
    $('.main_video_button').html(html);
}

const setStopVideo = () => {
    const html = `
    <i class="fas fa-video"></i>
    <span>Stop Video</span>`
    $('.main_video_button').html(html);
}


const playStop = () => {
    let enabled = myVideoStream.getVideoTracks()[0].enabled;
    if(enabled){
        myVideoStream.getVideoTracks()[0].enabled = false;
        setPlayVideo();
    }
    else {
        setStopVideo();
        myVideoStream.getVideoTracks()[0].enabled = true;
    }
}