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
      for (var inp in audio_nodes[e.target.id].inputs) {
        if (audio_nodes[e.target.id].inputs[inp].connection !== undefined) {
          audio_nodes[e.target.id].inputs[inp].connection.line.position();
        }
      }

      for (var out in audio_nodes[e.target.id].outputs) {
        for (var conn in audio_nodes[e.target.id].outputs[out].connections) {
          if (
            audio_nodes[e.target.id].outputs[out].connections[conn] !==
            undefined
          ) {
            audio_nodes[e.target.id].outputs[out].connections[
              conn
            ].line.position();
          }
        }
      }
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
      (lastHovered.dataset.connType === "input" ||
        lastHovered.dataset.connType === "output") &&
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

      audio_nodes[start.id].connect(start, end);
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

    document.body.append(trackingElement);
    document.addEventListener("mousemove", onTrackElement);
    document.addEventListener("mouseover", onTrackHoverElement);
    document.addEventListener("mouseout", onTrackOutElement);

    if (
      //? Disconnect connection (line) logic, occurs when grabbing input that's already connected
      e.target.dataset.connType === "input" &&
      audio_nodes[e.target.id].inputs[e.target.dataset.name].connection !==
        undefined
    ) {
      currentLine = new LeaderLine({
        start:
          audio_nodes[e.target.id].inputs[e.target.dataset.name].connection.line
            .start,
        end: document.getElementById("tracking_element"),
        startPlug: "disc",
        dash: { animation: true },
      });

      audio_nodes[e.target.id].inputs[
        e.target.dataset.name
      ].connection.node.disconnect(
        audio_nodes[e.target.id],
        audio_nodes[e.target.id].inputs[e.target.dataset.name].connection.line
          .start.dataset.name,
        e.target.dataset.name
      );

      audio_nodes[e.target.id].inputs[
        e.target.dataset.name
      ].connection = undefined;
    } else {
      //? Normal Output -> Input
      currentLine = new LeaderLine({
        start: e.target,
        end: document.getElementById("tracking_element"),
        startPlug: "disc",
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

    this.outputs = {};
    this.inputs = {};

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

    //? Tiding things up
    this.element.append(
      this.title,
      this.parameterContainer,
      this.inputContainer,
      this.outputContainer
    );

    makeDrag(this.element);
  }

  createInput(name, index) {
    if (this.inputs[name] === undefined) {
      this.inputs[name] = { index: index, connection: undefined };

      var input = document.createElement("div");
      input.className = "connectionNode input";
      input.ondragstart = (e) => {
        e.preventDefault();
      };
      input.id = this.id;
      input.dataset.name = name;
      input.dataset.connType = "input";

      input.onmousedown = onConnectionDown;

      this.inputContainer.append(input);
    } else {
      throw new Error("Input already exists!");
    }
  }

  createOutput(name, index) {
    if (this.outputs[name] === undefined) {
      this.outputs[name] = { index: index, connections: {} };

      var output = document.createElement("div");
      output.className = "connectionNode output";
      output.ondragstart = (e) => {
        e.preventDefault();
      };

      output.id = this.id;
      output.dataset.name = name;
      output.dataset.connType = "output";

      output.onmousedown = onConnectionDown;

      this.outputContainer.append(output);
    } else {
      throw new Error("Output already exists!");
    }
  }

  connect(start, end) {
    //? Connects output of this node
    var newConnection = new LeaderLine({
      start: start,
      end: end,
      startPlug: "disc",
    });

    if (audio_nodes[end.id].inputs[end.dataset.name].connection !== undefined) {
      //? If input already connected
      audio_nodes[
        audio_nodes[end.id].inputs[end.dataset.name].connection.line.start.id
      ].disconnect(
        audio_nodes[end.id],
        audio_nodes[end.id].inputs[end.dataset.name].connection.line.start
          .dataset.name,
        end.dataset.name
      );
    }

    audio_nodes[end.id].inputs[end.dataset.name].connection = {
      node: audio_nodes[start.id],
      line: newConnection,
    };

    this.outputs[start.dataset.name].connections[end.id] = {
      node: audio_nodes[end.id],
      line: newConnection,
    };

    this.processor.connect(
      audio_nodes[end.id].processor,
      this.outputs[start.dataset.name].index,
      audio_nodes[end.id].inputs[end.dataset.name].index
    );
  }

  disconnect(node, outNodeName, targetNodeInpName) {
    //? Disconnects output of this node
    this.processor.disconnect(
      node.processor,
      this.outputs[outNodeName].index,
      node.inputs[targetNodeInpName].index
    );
    this.outputs[outNodeName].connections[node.id].line.remove();
    delete this.outputs[outNodeName].connections[node.id];
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

    parameterDiv.append(label);
    parameterDiv.append(inputBox);
    this.parameters[name] = { label: label, input: inputBox };
    this.parameterContainer.append(parameterDiv);
  }

  createSpace(width = 0, height = 100) {
    var space = document.createElement("div");
    space.style.width = width.toString() + "px";
    space.style.height = height.toString() + "px";
    this.element.append(space);
  }

  hide() {
    this.element.style.opacity = "0";
    for (var inp in this.inputs) {
      if (this.inputs[inp].connection !== undefined) {
        this.inputs[inp].connection.line.hide();
      }
    }
  }

  show() {
    this.element.style.opacity = "1";
    for (var inp in this.inputs) {
      if (this.inputs[inp].connection !== undefined) {
        this.inputs[inp].connection.line.show();
      }
    }
  }
}

class DisplayGainNode extends DisplayAudioNode {
  constructor(context) {
    super(context.createGain());

    this.createInput("Input", 0);
    this.createOutput("Output", 0);

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

class DisplayStreamSourceNode extends DisplayAudioNode {
  constructor(context, stream) {
    super(context.createMediaStreamSource(stream));

    this.createOutput("Output", 0);
  }
}

class DisplayStreamDestinationNode extends DisplayAudioNode {
  constructor(context) {
    super(context.createMediaStreamDestination());

    this.createInput("Input", 0);
  }
}

class DisplayChannelMergerNode extends DisplayAudioNode {
  constructor(context, inputNo = 6) {
    super(context.createChannelMerger(inputNo));

    for (var i = 0; i < inputNo; i++) {
      this.createInput(`Channel ${i + 1}`, i);
    }

    this.createOutput("Output", 0);
    this.createSpace(0, 100)
  }
}

class DisplayChannelSplitterNode extends DisplayAudioNode {
  constructor(context, outputNo = 6) {
    super(context.createChannelSplitter(outputNo));

    for (var i = 0; i < outputNo; i++) {
      this.createOutput(`Channel ${i + 1}`, i);
    }

    this.createInput("Input", 0);
    this.createSpace(0, 100)
  }
}
