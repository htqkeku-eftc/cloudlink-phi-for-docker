package handlers

import (
	"log"

	"github.com/MikeDev101/cloudlink-phi/server/pkg/manager"
	"github.com/MikeDev101/cloudlink-phi/server/pkg/signaling/message"
	"github.com/MikeDev101/cloudlink-phi/server/pkg/structs"
)

// INIT handles the INIT opcode, which is used to initialize a new connection to the signaling server.
//
// The packet payload is just a string, and the response payload is a structs.SignalPacket with the opcode
// set to "INIT_OK" and the payload containing a structs.InitOK, which contains the user ID, game, and
// developer identifier. The response packet will be sent to the client that sent the packet.
func INIT(s *structs.Server, client *structs.Client, packet *structs.SignalPacket) {

	// If the peer is already authorized, send a SESSION_EXISTS opcode
	if client.AmIAuthorized() {
		err := message.Code(
			client,
			"SESSION_EXISTS",
			nil,
			packet.Listener,
			nil,
		)
		if err != nil {
			log.Printf("Send SESSION_EXISTS response to INIT opcode error: %s", err.Error())
		}
		return
	}

	// Set username
	client.Username = packet.Payload.(string)
	client.StoreAuthorization("")

	// Dummy values for now
	err := message.Code(
		client,
		"INIT_OK",
		&structs.InitOK{
			User:      client.Username,
			Id:        client.ID,
			SessionID: client.Session,
		},
		packet.Listener,
		nil,
	)
	if err != nil {
		log.Printf("Send response to INIT opcode error: %s", err.Error())
	}

	// Phi-specific code: Check if the default room exists. If it doesn't, create it and make the client the host. Otherwise, join it.
	if manager.DoesLobbyExist(s, "default", client.UGI) {
		JoinLobby(s, client, &structs.PeerConfigPacket{
			Payload: &structs.PeerConfigParams{
				LobbyID: "default",
			},
		}, "")

	} else {
		OpenLobby(s, client, &structs.HostConfigPacket{
			Payload: &structs.LobbySettings{
				LobbyID:             "default",
				UseServerRelay:      true,
				AllowHostReclaim:    true,
				AllowPeersToReclaim: false,
			},
		}, "")
	}

	// Allow the client to change modes later
	client.InitialTransitionOverride = true
}
