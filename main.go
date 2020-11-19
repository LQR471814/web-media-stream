package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

//Signal defines the structure of every message sent over the signalling channel
type Signal struct {
	MsgType           string
	Name              string
	ID                int
	To                int
	SDP               string
	ICE               string
	ClientConnections string
}

//Client defines the information of a client
type Client struct {
	Name string
	ID   int
	Conn *websocket.Conn
}

var viewerConns = make(map[int]*websocket.Conn)
var clients = make(map[int]*Client)

func main() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)

	var server = &http.Server{Addr: "0.0.0.0" + ":3000"}

	http.HandleFunc("/clientSocket", client)
	http.HandleFunc("/viewerSocket", viewer)
	http.Handle("/", http.FileServer(http.Dir("./site")))
	log.Fatal(server.ListenAndServeTLS("lan.crt", "lan.key"))
}

func client(w http.ResponseWriter, r *http.Request) {
	c, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Fatal(err)
		return
	}
	for {
		_, data, err := c.ReadMessage()
		if err != nil {
			log.Println(err)
			return
		}
		var message = &Signal{}
		json.Unmarshal(data, message)
		fmt.Println("Client:", message)

		switch message.MsgType {
		case "register_client":
			clients[message.ID] = &Client{message.Name, message.ID, c}
			clientConnections := generateClientConnectionsUpdate()
			for _, conn := range viewerConns {
				conn.WriteMessage(websocket.TextMessage, clientConnections)
			}
		case "offer", "ice":
			viewerConns[message.To].WriteMessage(websocket.TextMessage, data)
		case "unregister_client":
			delete(clients, message.ID)
			clientConnections := generateClientConnectionsUpdate()
			for _, conn := range viewerConns {
				conn.WriteMessage(websocket.TextMessage, clientConnections)
			}
			return
		}
	}
}

func viewer(w http.ResponseWriter, r *http.Request) {
	c, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Fatal(err)
		return
	}
	for {
		_, data, err := c.ReadMessage()
		if err != nil {
			log.Println(err)
			return
		}
		message := &Signal{}
		json.Unmarshal(data, message)
		fmt.Println("Viewer:", message)

		switch message.MsgType {
		case "register_viewer":
			viewerConns[message.ID] = c
			c.WriteMessage(websocket.TextMessage, generateClientConnectionsUpdate())
		case "request_offer", "ice":
			clients[message.To].Conn.WriteMessage(websocket.TextMessage, data)
		case "answer":
			clients[message.To].Conn.WriteMessage(websocket.TextMessage, data)
		case "unregister_viewer":
			delete(viewerConns, message.ID)
			return
		}
	}
}

func generateClientConnectionsUpdate() []byte {
	strClientConns, err := json.Marshal(clients)
	if err != nil {
		log.Fatal(err)
	}
	resMsg := Signal{"client_connections", "", 0, 0, "", "", string(strClientConns)}
	res, err := json.Marshal(resMsg)

	return res
}
