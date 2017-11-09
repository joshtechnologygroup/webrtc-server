/** browser dependent definition are aligned to one and the same standard name **/
navigator.getUserMedia = navigator.getUserMedia || navigator.mozGetUserMedia || navigator.webkitGetUserMedia;
window.RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
window.RTCIceCandidate = window.RTCIceCandidate || window.mozRTCIceCandidate || window.webkitRTCIceCandidate;
window.RTCSessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription || window.webkitRTCSessionDescription;
window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || window.mozSpeechRecognition 
  || window.msSpeechRecognition || window.oSpeechRecognition;

var config = {
  wssHost: 'wss://192.168.1.201:8089/ws'
};
var CLOSE_CONNECTION_FLAG = "close connection";
var SEND_COMMAND = "send";
var REGISTER_COMMAND = "register";

var clientId = null;
var roomId = null;
var wsc = null;
var peerConn = null;
var localVideoElem = null;
var remoteVideoElem = null;
var localVideoStream = null;
var videoCallButton = null;
var endCallButton = null;

function setUpWebSocket() {
    wsc = new WebSocket(config.wssHost);
    wsc.onmessage = webSocketMessageReceiver;
}

function getPeerConfig() {
    return {'iceServers':
        [
            {'url': 'stun:stun.l.google.com:19302'},
            {
                url: 'turn:192.158.29.39:3478?transport=tcp',
                credential: 'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
                username: '28224511:1379330808'
            }
        ]
    };
}
    
function testPageReady() {
  // check browser WebRTC availability 
  if(navigator.getUserMedia) {
    videoCallButton = document.getElementById("videoCallButton");
    endCallButton = document.getElementById("endCallButton");
    localVideoElem = document.getElementById('localVideo');
    remoteVideoElem = document.getElementById('remoteVideo');
    videoCallButton.addEventListener("click", initiateCall);
    videoCallButton.removeAttribute("disabled");
    setUpWebSocket();
    wsc.onopen = function () {
        registerClientInRoom("1", (Math.floor(Math.random() * 100) + 1).toString());
    };
    endCallButton.addEventListener("click", endCall);
  } else {
    alert("Sorry, your browser does not support WebRTC!")
  }
};

/**
 * This method does initial setup of client in room. This method must be called before any other method in this file.
 *
 * @param roomId Room in which call will take place. Group of people attending same call will be in same room.
 * @param clientId Unique id of each person attending the call.
 * @throws Error, If browser being used doesn't support WebRTC.
 */
function setupClient(roomId, clientId) {
    if(navigator.getUserMedia) {
        localVideoElem = document.getElementById('localVideo');
        remoteVideoElem = document.getElementById('remoteVideo');
        setUpWebSocket();
        wsc.onopen = function () {
            registerClientInRoom(roomId, clientId);
        };
    } else {
        throw new Error("Browser does not support WebRTC");
    }
}

function registerClientInRoom(roomName, clientIdString) {
    roomId = roomName;
    clientId = clientIdString;
    sendWebSocketMsg(REGISTER_COMMAND, roomId, clientId, "none");
}

function prepareCall() {
    peerConn = new RTCPeerConnection(getPeerConfig());
    // send any ice candidates to the other peer
    peerConn.onicecandidate = onIceCandidateHandler;
    // once remote stream arrives, show it in the remote video element
    peerConn.onaddstream = onAddStreamHandler;
};

/**
 * This method starts video call. It must be called after setupClient.
 */
function initiateCall() {
  prepareCall();
  // get the local stream, show it in the local video element and send it
  navigator.getUserMedia({ "audio": true, "video": true }, function (stream) {
    localVideoStream = stream;
    localVideoElem.srcObject = localVideoStream;
    peerConn.addStream(localVideoStream);
    createAndSendOffer();
  }, function(error) { console.log(error);});
};

function answerCall() {
  prepareCall();
  // get the local stream, show it in the local video element and send it
  navigator.getUserMedia({ "audio": true, "video": true }, function (stream) {
    localVideoStream = stream;
    localVideoElem.srcObject = localVideoStream;
    peerConn.addStream(localVideoStream);
    createAndSendAnswer();
  }, function(error) { console.log(error);});
};

function webSocketMessageReceiver(evt) {
  if (!peerConn) answerCall();
  var signal = JSON.parse(evt.data);
  var msg = JSON.parse(signal.msg);
  if (msg.hasOwnProperty("sdp")) {
    console.log("Received SDP from remote peer.");
    peerConn.setRemoteDescription(new RTCSessionDescription(msg));
  }
  else if (msg.hasOwnProperty("candidate")) {
    console.log("Received ICECandidate from remote peer.");
    peerConn.addIceCandidate(new RTCIceCandidate(msg));
  } else if (msg == CLOSE_CONNECTION_FLAG){
    console.log("Received 'close call' signal from remote peer.");
    endCall();
  }
};

function createAndSendOffer() {
  peerConn.createOffer(
    function (offer) {
      var off = new RTCSessionDescription(offer);
      peerConn.setLocalDescription(new RTCSessionDescription(off),
          function() {
            sendWebSocketMsg(SEND_COMMAND, roomId, clientId, JSON.stringify(off));
          },
          function(error) { console.log(error);}
      );
    }, 
    function (error) { console.log(error);}
  );
};

function createAndSendAnswer() {
  peerConn.createAnswer(
    function (answer) {
      var ans = new RTCSessionDescription(answer);
      peerConn.setLocalDescription(new RTCSessionDescription(ans),
          function() {
            sendWebSocketMsg(SEND_COMMAND, roomId, clientId, JSON.stringify(ans));
          },
          function(error) { console.log(error);}
      );
    },
    function (error) {console.log(error);}
  );
};

function onIceCandidateHandler(evt) {
  if (!evt || !evt.candidate) return;
    sendWebSocketMsg(SEND_COMMAND, roomId, clientId, JSON.stringify(evt.candidate));
};

function onAddStreamHandler(evt) {
  videoCallButton.setAttribute("disabled", true);
  endCallButton.removeAttribute("disabled"); 
  // set remote video stream as source for remote video HTML5 element
  remoteVideoElem.srcObject = evt.stream;
};

/**
 * This method ends undergoing call. Once called, It will end peer connection and stop all videos.
 */
function endCall() {
    sendWebSocketMsg("send", roomId, clientId, JSON.stringify(CLOSE_CONNECTION_FLAG));
    peerConn.close();
    peerConn = null;
    endCallButton.setAttribute("disabled", true);
    if (localVideoStream) {
        localVideoStream.getTracks().forEach(function (track) {
            track.stop();
        });
        localVideoElem.src = "";
    }
    if (remoteVideoElem) remoteVideoElem.src = "";
    wsc.close();
};

function sendWebSocketMsg(command, roomId, clientId, msg) {
    wsc.send(JSON.stringify({"cmd": command, "roomid": roomId, "clientid": clientId, "msg": msg }));
}
