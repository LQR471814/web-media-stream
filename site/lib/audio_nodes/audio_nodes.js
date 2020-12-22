var audio_nodes = {};

function makeDrag(elmnt) {
  var pos1 = 0,
    pos2 = 0,
    pos3 = 0,
    pos4 = 0;
  elmnt.onmousedown = dragMouseDown;
  elmnt.oncontextmenu = (e) => {
    return false;
  };

  function dragMouseDown(e) {
    if (e.button === 2 || e.altKey === true) {
      e = e || window.event;
      e.preventDefault();
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.onmouseup = closeDragElement;
      document.onmousemove = elementDrag;
    }
  }

  function elementDrag(e) {
    e = e || window.event;
    e.preventDefault();
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    elmnt.style.top = elmnt.offsetTop - pos2 + "px";
    elmnt.style.left = elmnt.offsetLeft - pos1 + "px";
    if (audio_nodes[e.target.id] !== undefined) {
      if (audio_nodes[e.target.id].inputConn !== undefined) {
        audio_nodes[e.target.id].inputConn.line.position();
      }
      audio_nodes[e.target.id].connections.forEach((val) => {
        val.line.position();
      });
    }
  }

  function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

function onTrackElement(e) {
  currentLine.position();
  document.getElementById("tracking_element").style.left = e.pageX + "px";
  document.getElementById("tracking_element").style.top = e.pageY + "px";
}

function onTrackHoverElement(e) {
  lastHovered = e.target;
}

function onTrackOutElement(e) {
  lastHovered = undefined;
}

function onConnectionMade(e) {
  document.body.removeChild(document.getElementById("tracking_element"));
  document.body.onmouseup = (e) => {};

  document.removeEventListener("mousemove", onTrackElement);
  document.removeEventListener("mouseover", onTrackHoverElement);
  document.removeEventListener("mouseout", onTrackOutElement);

  if (lastHovered !== undefined) {
    if (
      lastHovered.id !== "audio_nodes" &&
      lastHovered.id !== currentLine.start.id &&
      lastHovered.dataset.connType !== currentLine.start.dataset.connType &&
      lastHovered.dataset.connType !== undefined
    ) {
      if (currentLine.start.dataset.connType === "input") {
        //? Connecting output -> input
        var start = lastHovered;
        var end = currentLine.start;
      } else {
        //? Connecting input -> output
        var start = currentLine.start;
        var end = lastHovered;
      }

      var newConnection = new LeaderLine({
        start: start,
        end: end,
        showEffectName: "draw",
      });
      if (audio_nodes[end.id].inputConn !== undefined) {
        //? If input already connected
        audio_nodes[end.id].inputConn.node.disconnect(audio_nodes[end.id]);
      }
      audio_nodes[end.id].inputConn = {
        node: audio_nodes[start.id],
        line: newConnection,
      };
      audio_nodes[start.id].connect(audio_nodes[end.id], newConnection);
    }
  }
  currentLine.remove();
}

function onConnectionDown(e) {
  if (e.altKey === false && e.button === 0) {
    var trackingElement = document.createElement("div");
    trackingElement.id = "tracking_element";
    trackingElement.style = "position: fixed;";

    connectionNodeBox = e.target.getBoundingClientRect();

    trackingElement.style.left = connectionNodeBox.left;
    trackingElement.style.top = connectionNodeBox.top;

    document.body.appendChild(trackingElement);
    document.addEventListener("mousemove", onTrackElement);
    document.addEventListener("mouseover", onTrackHoverElement);
    document.addEventListener("mouseout", onTrackOutElement);

    if (
      //? Output -> Input disconnect connection
      audio_nodes[e.target.id].inputConn !== undefined &&
      e.target.dataset.connType === "input"
    ) {
      currentLine = new LeaderLine({
        start: audio_nodes[e.target.id].inputConn.line.start,
        end: document.getElementById("tracking_element"),
        dash: { animation: true },
      });
      audio_nodes[e.target.id].inputConn.node.disconnect(
        audio_nodes[e.target.id]
      );
      audio_nodes[e.target.id].inputConn = undefined;
    } else {
      currentLine = new LeaderLine({
        start: e.target,
        end: document.getElementById("tracking_element"),
        dash: { animation: true },
      });
    }

    document.body.onmouseup = onConnectionMade;
  }
}

class DisplayAudioNode {
  constructor(processorNode) {
    //? Init Misc
    this.processor = processorNode;

    this.parameters = {};
    this.parameterContainer = document.createElement("div");

    this.connections = [];
    this.inputConn = undefined;

    this.id = "_" + Math.random().toString(36).substr(2, 9);
    audio_nodes[this.id] = this;

    //? Initialize Main Element
    this.element = document.createElement("div");
    this.element.className = "audioNode";
    this.element.id = this.id;

    //? Initialize Title
    this.title = document.createElement("p");
    this.title.id = this.id;

    this.title.innerText = processorNode.constructor.name;
    this.title.className = "nodeLabel";
    this.title.draggable = "false";
    this.title.ondragstart = (e) => {
      e.preventDefault();
    };

    //? Initialize Inputs and Outputs
    this.inputContainer = document.createElement("div");
    this.outputContainer = document.createElement("div");
    this.inputContainer.id = this.id;
    this.outputContainer.id = this.id;

    this.inputContainer.className = "connectionGroup inputs";
    this.outputContainer.className = "connectionGroup outputs";

    for (var i = 0; i < this.processor.numberOfInputs; i++) {
      var input = document.createElement("div");
      input.className = "connectionNode input";
      input.ondragstart = (e) => {
        e.preventDefault();
      };
      input.id = this.id;
      input.dataset.connType = "input";

      input.onmousedown = onConnectionDown;

      this.inputContainer.appendChild(input);
    }

    for (var i = 0; i < this.processor.numberOfOutputs; i++) {
      var output = document.createElement("div");
      output.className = "connectionNode output";
      output.ondragstart = (e) => {
        e.preventDefault();
      };
      output.id = this.id;
      output.dataset.connType = "output";

      output.onmousedown = onConnectionDown;

      this.outputContainer.appendChild(output);
    }

    //? Append elements to DOM
    this.element.appendChild(this.title);
    this.element.appendChild(this.parameterContainer);
    this.element.appendChild(this.inputContainer);
    this.element.appendChild(this.outputContainer);

    makeDrag(this.element);
  }

  connect(node, line) {
    this.connections.push({ node: node, line: line });
    this.processor.connect(node.processor);
  }

  disconnect(node) {
    for (var i = 0; i < this.connections.length; i++) {
      if (this.connections[i].line === node.inputConn.line) {
        this.connections.splice(i, 1);
      }
    }
    this.processor.disconnect(node.processor);
    node.inputConn.line.remove();
  }

  addParameterValueInput(name, callback, def) {
    var parameterDiv = document.createElement("div");
    parameterDiv.style.display = "flex";
    parameterDiv.style.padding = "10px 25px 10px 25px";

    var label = document.createElement("span");
    label.innerText = name;
    label.style.margin = "5px 0px 5px 0px";
    label.className = "parameterLabel";
    label.draggable = "false";
    label.ondragstart = (e) => {
      e.preventDefault();
    };

    var inputBox = document.createElement("input");
    inputBox.type = "text";
    inputBox.value = def;
    inputBox.id = this.id;
    inputBox.className = "parameterInput";
    inputBox.addEventListener("focusout", callback);

    parameterDiv.appendChild(label);
    parameterDiv.appendChild(inputBox);
    this.parameters[name] = { label: label, input: inputBox };
    this.parameterContainer.appendChild(parameterDiv);
  }
}

class DisplayGainNode extends DisplayAudioNode {
  constructor(context) {
    super(context.createGain());

    this.addParameterValueInput(
      "Gain",
      (e) => {
        if (/^\-?\d+\.?\d*$/.test(e.target.value) === true) {
          audio_nodes[e.target.id].processor.gain.value = parseInt(
            e.target.value
          );
        } else {
          e.target.value = audio_nodes[
            e.target.id
          ].processor.gain.value.toString();
        }
      },
      this.processor.gain.value.toString()
    );
  }
}
