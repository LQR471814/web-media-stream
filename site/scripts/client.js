var currentLine;
var lastHovered;
var mouseIsOver = false;

var audioNodesContainer = document.getElementById("audio_nodes");
var audioButton = document.getElementById("audio_button");
var buttonTrigger = document.getElementById("button_trigger");

var buttonTriggerBox = document
  .getElementById("button_trigger")
  .getBoundingClientRect();

window.onresize = (e) => {
  buttonTriggerBox = document
    .getElementById("button_trigger")
    .getBoundingClientRect();
};

buttonTrigger.onmouseover = (e) => {
  audioButton.style.right = "40px";
};
buttonTrigger.onmouseout = (e) => {
  if (
    !(
      e.clientX >= buttonTriggerBox.left &&
      e.clientX <= buttonTriggerBox.right &&
      e.clientY >= buttonTriggerBox.top &&
      e.clientY <= buttonTriggerBox.bottom
    )
  ) {
    audioButton.style.right = "-60px";
  }
};

audioButton.onclick = (e) => {
  //? Audio Button onclick
  if (
    window.getComputedStyle(document.getElementById("audio_overlay"))
      .backdropFilter === "blur(5px) opacity(0)"
  ) {
    //? Show audio nodes
    document.getElementById("audio_overlay").style.backdropFilter =
      "blur(5px) opacity(1)";
    audioNodesContainer.style.opacity = "1";
    for (var item in audio_nodes) {
      if (audio_nodes[item].inputConn !== undefined) {
        audio_nodes[item].inputConn.line.show();
      }
    }
  } else {
    //? Hide audio nodes
    document.getElementById("audio_overlay").style.backdropFilter =
      "blur(5px) opacity(0)";
    audioNodesContainer.style.opacity = "0";
    for (var item in audio_nodes) {
      if (audio_nodes[item].inputConn !== undefined) {
        audio_nodes[item].inputConn.line.hide();
      }
    }
  }
};

var peerConnections = {};
var signalingChannel = new WebSocket(
  `wss://${window.location.host}/clientSocket`
);
var clientID = Math.floor(Math.random() * Date.now());
var peerID;

var username = prompt("Username", "");

try {
  var stream = navigator.mediaDevices
    .getUserMedia({ video: true, audio: true })
    .then((value) => {
      document.getElementById("video_preview").srcObject = value;
      stream = value;
      videoTracks = stream.getVideoTracks();
      context = new AudioContext();
      src = new DisplayStreamSourceNode(context, stream);
      out = new DisplayStreamDestinationNode(context);
      gain = new DisplayGainNode(context);

      document.getElementById("audio_nodes").appendChild(src.element);
      document.getElementById("audio_nodes").appendChild(out.element);
      document.getElementById("audio_nodes").appendChild(gain.element);
    });
} catch (e) {
  alert(e);
}

signalingChannel.onopen = (e) => {
  signalingChannel.send(
    JSON.stringify({
      MsgType: "register_client",
      ID: clientID,
      Name: username,
    })
  );
};
signalingChannel.onmessage = async (e) => {
  var message = JSON.parse(e.data);
  console.log(message);
  if (message.MsgType === "request_offer") {
    peerID = message.ID;

    var peerResult = await createPeerConn();
    peerConnections[message.ID] = peerResult.conn;
    signalingChannel.send(
      JSON.stringify({
        MsgType: "offer",
        To: message.ID,
        ID: clientID,
        SDP: peerResult.ofr,
      })
    );
  } else if (message.MsgType === "answer") {
    await peerConnections[message.ID].setRemoteDescription(message.SDP);
    console.log("Set remote description success");
  } else if (message.MsgType === "ice") {
    await peerConnections[message.ID].addIceCandidate(message.ICE);
  }
};
window.onbeforeunload = (e) => {
  for (conn in peerConnections) {
    peerConnections[conn].close();
  }
  signalingChannel.send(
    JSON.stringify({ MsgType: "unregister_client", ID: clientID })
  );
};

async function createPeerConn() {
  var peerConnection = new RTCPeerConnection();

  peerConnection.onicecandidate = async (e) => {
    if (e.candidate !== null) {
      signalingChannel.send(
        JSON.stringify({
          MsgType: "ice",
          To: peerID,
          ID: clientID,
          ICE: e.candidate,
        })
      );
    }
  };
  peerConnection.oniceconnectionstatechange = (e) => {
    console.log(`ICE State Change: ${e.target.iceConnectionState}`);
    if (e.target.iceConnectionState === "disconnected") {
      e.target.close();
    }
  };

  stream.getTracks().map((track) => peerConnection.addTrack(track));

  var offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  console.log("Set local description success");

  return { conn: peerConnection, ofr: offer };
}
