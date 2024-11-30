package handlers

import (
	"log"

	"github.com/MikeDev101/cloudlink-phi/server/pkg/manager"
	"github.com/MikeDev101/cloudlink-phi/server/pkg/signaling/message"
	"github.com/MikeDev101/cloudlink-phi/server/pkg/structs"
)

func LOBBY_LIST(s *structs.Server, client *structs.Client, packet *structs.SignalPacket) {

	// Require the peer to be authorized
	if !client.AmIAuthorized() {
		err := message.Code(
			client,
			"CONFIG_REQUIRED",
			nil,
			packet.Listener,
			nil,
		)
		if err != nil {
			log.Printf("Send CONFIG_REQUIRED response to LOBBY_LIST opcode error: %s", err.Error())
		}
		return
	}

	message.Code(
		client,
		"LOBBY_LIST",
		manager.GetAllLobbies(s, client.UGI),
		packet.Listener,
		nil,
	)
}
