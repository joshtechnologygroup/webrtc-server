/** browser dependent definition are aligned to one and the same standard name **/
navigator.getUserMedia = navigator.getUserMedia || navigator.mozGetUserMedia || navigator.webkitGetUserMedia;
window.RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
window.RTCIceCandidate = window.RTCIceCandidate || window.mozRTCIceCandidate || window.webkitRTCIceCandidate;
window.RTCSessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription || window.webkitRTCSessionDescription;
window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || window.mozSpeechRecognition 
  || window.msSpeechRecognition || window.oSpeechRecognition;

var config = {
  wssHost: 'wss://192.168.1.201:8089/ws'
  // wssHost: 'wss://example.com/myWebSocket'
};
var clientId = Math.floor(Math.random() * 100) + 1;
var localVideoElem = null, 
  remoteVideoElem = null, 
  localVideoStream = null,
  videoCallButton = null,
  registerButton = null,
  endCallButton = null;
var peerConn = null,
  wsc = new WebSocket(config.wssHost),
  peerConnCfg = {'iceServers':
    [
        {'url': 'stun:stun.l.google.com:19302'},
        {
            url: 'turn:192.158.29.39:3478?transport=tcp',
            credential: 'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
            username: '28224511:1379330808'
        }
    ]
  };
    
function pageReady() {
  // check browser WebRTC availability 
  if(navigator.getUserMedia) {
    videoCallButton = document.getElementById("videoCallButton");
    registerButton = document.getElementById("registerButton");
    endCallButton = document.getElementById("endCallButton");
    localVideoElem = document.getElementById('localVideo');
    remoteVideoElem = document.getElementById('remoteVideo');
    registerButton.removeAttribute("disabled");
    videoCallButton.addEventListener("click", initiateCall);
    registerButton.addEventListener("click", registerClient);
    endCallButton.addEventListener("click", function (evt) {
      wsc.send(JSON.stringify({"closeConnection": true }));
    });
  } else {
    alert("Sorry, your browser does not support WebRTC!")
  }
};

function prepareCall() {
  peerConn = new RTCPeerConnection(peerConnCfg);
  // send any ice candidates to the other peer
  peerConn.onicecandidate = onIceCandidateHandler;
  // once remote stream arrives, show it in the remote video element
  peerConn.onaddstream = onAddStreamHandler;
};

function registerClient() {
    wsc.send(JSON.stringify({"cmd": "register", "roomid": "1", "clientid": clientId.toString(), "msg": "none"}));
    videoCallButton.removeAttribute("disabled");
    registerButton.disabled = true;
}

// run start(true) to initiate a call
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

wsc.onmessage = function (evt) {
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
  } else if (signal.closeConnection){
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
              wsc.send(JSON.stringify({"cmd": "send", "roomid": "1", "clientid": clientId.toString(), "msg": JSON.stringify(off) }));
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
              wsc.send(JSON.stringify({"cmd": "send", "roomid": "1", "clientid": clientId.toString(), "msg": JSON.stringify(ans) }));
          },
          function(error) { console.log(error);}
      );
    },
    function (error) {console.log(error);}
  );
};

function onIceCandidateHandler(evt) {
  if (!evt || !evt.candidate) return;
    wsc.send(JSON.stringify({"cmd": "send", "roomid": "1", "clientid": clientId.toString(), "msg": JSON.stringify(evt.candidate) }));
};

function onAddStreamHandler(evt) {
  videoCallButton.setAttribute("disabled", true);
  endCallButton.removeAttribute("disabled"); 
  // set remote video stream as source for remote video HTML5 element
  remoteVideoElem.srcObject = evt.stream;
};

function endCall() {
  peerConn.close();
  peerConn = null;
  videoCallButton.removeAttribute("disabled");
  endCallButton.setAttribute("disabled", true);
  if (localVideoStream) {
    localVideoStream.getTracks().forEach(function (track) {
      track.stop();
    });
    localVideoElem.src = "";
  }
  if (remoteVideoElem) remoteVideoElem.src = "";
};
