/** browser dependent definition are aligned to one and the same standard name **/
navigator.getUserMedia = navigator.getUserMedia || navigator.mozGetUserMedia || navigator.webkitGetUserMedia;
window.RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
window.RTCIceCandidate = window.RTCIceCandidate || window.mozRTCIceCandidate || window.webkitRTCIceCandidate;
window.RTCSessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription || window.webkitRTCSessionDescription;
window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || window.mozSpeechRecognition 
  || window.msSpeechRecognition || window.oSpeechRecognition;


function WebRTCCall (webSocketUrl, localVideoElementId, remoteVideoElementId){
    const peerConfig = {
        'iceServers': [
            {'url': 'stun:stun.l.google.com:19302'},
            {
                url: 'turn:192.158.29.39:3478?transport=tcp',
                credential: 'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
                username: '28224511:1379330808'
            }
        ]
    };
    const CLOSE_CONNECTION_FLAG = "close connection";
    const SEND_COMMAND = "send";
    const REGISTER_COMMAND = "register";

    let webSocketConfig = null;
    let wsc = null;
    let clientId = null;
    let roomId = null;
    let peerConn = null;
    let localVideoElem = null;
    let remoteVideoElem = null;
    let localVideoStream = null;

    if(navigator.getUserMedia) {
        webSocketConfig = webSocketUrl;
        localVideoElem = document.getElementById(localVideoElementId);
        remoteVideoElem = document.getElementById(remoteVideoElementId);
    } else {
        throw new Error("Browser does not support WebRTC");
    }

    /**
     * This method creates connection to signaling server, registers given user in given room.
     * Then it checks, if it is first user in that room or not. If it is, then it will create an offer message and send
     * it to signalling server for other users to recieve it.
     * If there is already a user in that room, Then it will end and javascript will wait till it receives an offer
     * message.
     *
     * @param room Room in which all users will connect, It will be unique to a group of clients present in same call.
     * @param userId Unique id of a user in a call.
     */
    this.initiateCall = function (room, userId) {
        roomId = room;
        clientId = userId;
        setUpWebSocket(webSocketConfig);
    };

    /**
     * This method ends all connections related to this call. It will also stop video stream on local and send
     * a message to all other clients to kill their connections as well.
     */
    this.endCall = function() {
        sendWebSocketMsg("send", JSON.stringify(CLOSE_CONNECTION_FLAG));
        endLocalCall();
    };

    let setUpWebSocket = function(webSocketConfig) {
        wsc = new WebSocket(webSocketConfig);
        wsc.onmessage = webSocketMessageReceiver;
        wsc.onopen = startCall;
    };

    let sendWebSocketMsg = function(command, msg) {
        wsc.send(JSON.stringify({"cmd": command, "roomid": roomId, "clientid": clientId, "msg": msg }));
    };

    let getClientCount = function (callback) {
        let xmlHttp = new XMLHttpRequest();

        xmlHttp.onreadystatechange = function() {
            if (xmlHttp.readyState === XMLHttpRequest.DONE) {
                if (xmlHttp.status === 200) {
                    callback(xmlHttp.responseText);
                }
                else if (xmlHttp.status === 400) {
                    throw new Error('There was an error 400');
                }
                else {
                    throw new Error('something else other than 200 was returned while counting clients');
                }
            }
        };
        xmlHttp.open("GET", "../status?rid=" + roomId, true);
        xmlHttp.send();
    };

    let startCall = function () {
        sendWebSocketMsg(REGISTER_COMMAND, "none");
        getClientCount(function (numberOfClients) {
            if (numberOfClients < 2 && peerConn === null) {
                prepareCall();
                // get the local stream, show it in the local video element and send it
                navigator.getUserMedia({ "audio": true, "video": true }, function (stream) {
                    localVideoStream = stream;
                    localVideoElem.srcObject = localVideoStream;
                    peerConn.addStream(localVideoStream);
                    createAndSendOffer();
                }, function(error) {
                    endLocalCall();
                    throw error;
                });
            }
        });
    };

    let prepareCall = function() {
        peerConn = new RTCPeerConnection(peerConfig);
        // send any ice candidates to the other peer
        peerConn.onicecandidate = onIceCandidateHandler;
        // once remote stream arrives, show it in the remote video element
        peerConn.onaddstream = onAddStreamHandler;
    };

    let webSocketMessageReceiver = function(evt) {
        if (!peerConn) {
            answerCall();
        }
        let signal = JSON.parse(evt.data);
        let msg = JSON.parse(signal.msg);
        if (msg.hasOwnProperty("sdp")) {
            console.log("Received SDP from remote peer.");
            peerConn.setRemoteDescription(new RTCSessionDescription(msg));
        }
        else if (msg.hasOwnProperty("candidate")) {
            console.log("Received ICECandidate from remote peer.");
            peerConn.addIceCandidate(new RTCIceCandidate(msg));
        } else if (msg === CLOSE_CONNECTION_FLAG){
            console.log("Received 'close call' signal from remote peer.");
            endLocalCall();
        }
    };

    let answerCall = function() {
        prepareCall();
        // get the local stream, show it in the local video element and send it
        navigator.getUserMedia({ "audio": true, "video": true }, function (stream) {
            localVideoStream = stream;
            localVideoElem.srcObject = localVideoStream;
            peerConn.addStream(localVideoStream);
            createAndSendAnswer();
        }, function(error) {
            endLocalCall();
            throw error;
        });
    };

    let createAndSendOffer = function() {
        peerConn.createOffer(
            function (offer) {
                let off = new RTCSessionDescription(offer);
                peerConn.setLocalDescription(new RTCSessionDescription(off),
                    function() {
                        sendWebSocketMsg(SEND_COMMAND, JSON.stringify(off));
                    },
                    function(error) {
                        endLocalCall();
                        throw error;
                    }
                );
            },
            function (error) {
                endLocalCall();
                throw error;
            }
        );
    };

    let createAndSendAnswer = function() {
        peerConn.createAnswer(
            function (answer) {
                let ans = new RTCSessionDescription(answer);
                peerConn.setLocalDescription(new RTCSessionDescription(ans),
                    function() {
                        sendWebSocketMsg(SEND_COMMAND, JSON.stringify(ans));
                    },
                    function(error) {
                        endLocalCall();
                        throw error;
                    }
                );
            },
            function (error) {
                endLocalCall();
                throw error;
            }
        );
    };

    let onIceCandidateHandler = function(evt) {
        if (!evt || !evt.candidate) return;
        sendWebSocketMsg(SEND_COMMAND, JSON.stringify(evt.candidate));
    };

    let onAddStreamHandler = function(evt) {
        // set remote video stream as source for remote video HTML5 element
        remoteVideoElem.srcObject = evt.stream;
    };

    let endLocalCall = function () {
        if (peerConn) {
            peerConn.close();
            peerConn = null;
        }
        if (localVideoStream) {
            localVideoStream.getTracks().forEach(function (track) {
                track.stop();
            });
            localVideoElem.src = "";
        }
        if (remoteVideoElem) remoteVideoElem.src = "";
        wsc.close();
    }

}
