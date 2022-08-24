const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const callButton = document.getElementById('callButton');
const hangupButton = document.getElementById('hangupButton');
const screenShareButton = document.getElementById('screenShareButton');
const socket = new WebSocket('wss://localhost:8888');

let peerConnection;
let localMediaStream;
let remoteId;
const remoteMediaStream = new MediaStream();

socket.onopen = () => {
  console.log('socket::open');
};

socket.onmessage = async ({ data }) => {
  try {
    const jsonMessage = JSON.parse(data);

    console.log('action', jsonMessage.action);
    switch (jsonMessage.action) {
      case 'start':
        console.log('start', jsonMessage.id);
        callButton.disabled = false;
        document.getElementById('localId').innerHTML = jsonMessage.id;
        break;
      case 'offer':
        remoteId = jsonMessage.data.remoteId;
        delete jsonMessage.data.remoteId;

        await initializePeerConnection(localMediaStream.getTracks());
        await peerConnection.setRemoteDescription(new RTCSessionDescription(jsonMessage.data.offer));

        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        sendSocketMessage('answer', { remoteId, answer });
        break;
      case 'answer':
        await peerConnection.setRemoteDescription(new RTCSessionDescription(jsonMessage.data.answer));
        break;
      case 'iceCandidate':
        await peerConnection.addIceCandidate(jsonMessage.data.candidate);
        break;
      default: console.warn('unknown action', jsonMessage.action);
    }
  } catch (error) {
    console.error('failed to handle socket message', error);
  }
};

socket.onerror = (error) => {
  console.error('socket::error', error);
};

socket.onclose = () => {
  console.log('socket::close');
  stop();
};

const sendSocketMessage = (action, data) => {
  const message = { action, data };
  socket.send(JSON.stringify(message));
};

const start = async () => {
  try {
    localMediaStream = await getLocalMediaStream();

    sendSocketMessage('start');
  } catch (error) {
    console.error('failed to start stream', error);
  }
};

const call = async () => {
  try {
    remoteId = document.getElementById('callId').value;

    if (!remoteId) {
      alert('Please enter a remote id');

      return;
    }

    console.log('call: ', remoteId);
    await initializePeerConnection(localMediaStream.getTracks());
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    sendSocketMessage('offer', { offer, remoteId });
  } catch (error) {
    console.error('failed to initialize call', error);
  }
};

const hangup = () => socket.close();

const stop = () => {
  if (!localVideo.srcObject) return;

  for (const track of localVideo.srcObject.getTracks()) {
    console.log('stop track', track);
    track.stop();
  }

  for (const sender of peerConnection.getSenders()) {
    sender.track.stop();
  }

  peerConnection.close();
  callButton.disabled = true;
  hangupButton.disabled = true;
  screenShareButton.disabled = true;
  localVideo.srcObject = undefined;
  remoteVideo.srcObject = undefined;
};

const getLocalMediaStream = async () => {
  try {
    const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    console.log('got local media stream');

    localVideo.srcObject = mediaStream;

    return mediaStream;
  } catch (error) {
    console.error('failed to get local media stream', error);
  }
};

const initializePeerConnection = async (mediaTracks) => {
  const config = { iceServers: [{ urls: [ 'stun:stun1.l.google.com:19302' ] } ] };
  peerConnection = new RTCPeerConnection(config);

  peerConnection.onicecandidate = ({ candidate }) => {
    if (!candidate) return;

    console.log('peerConnection::icecandidate', candidate);
    console.log('remote', remoteId);
    sendSocketMessage('iceCandidate', { remoteId, candidate });
  };

  peerConnection.oniceconnectionstatechange = () => {
    console.log('peerConnection::iceconnectionstatechange newState=', peerConnection.iceConnectionState);
    // If ICE state is disconnected stop
    if (peerConnection.iceConnectionState === 'disconnected') {
      alert('Connection has been closed stopping...');
      socket.close();
    }
  };

  peerConnection.ontrack = ({ track }) => {
    console.log('peerConnection::track', track);
    remoteMediaStream.addTrack(track);
    remoteVideo.srcObject = remoteMediaStream;
  };

  for (const track of mediaTracks) {
    peerConnection.addTrack(track);
  }

  hangupButton.disabled = false;
  screenShareButton.disabled = false;
};

const shareScreen = async () => {
  const mediaStream = await getLocalScreenCaptureStream();

  const screenTrack = mediaStream.getVideoTracks()[0];

  if (screenTrack) {
    console.log('replace camera track with screen track');
    replaceTrack(screenTrack);
  }
};

const getLocalScreenCaptureStream = async () => {
  try {
    const constraints = { video: { cursor: 'always' }, audio: false };
    const screenCaptureStream = await navigator.mediaDevices.getDisplayMedia(constraints);

    return screenCaptureStream;
  } catch (error) {
    console.error('failed to get local screen', error);
  }
};

const replaceTrack = (newTrack) => {
  const sender = peerConnection.getSenders().find(sender =>
    sender.track.kind === newTrack.kind
  );

  if (!sender) {
    console.warn('failed to find sender');

    return;
  }

  sender.replaceTrack(newTrack);
}
