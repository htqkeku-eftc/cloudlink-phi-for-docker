package session

import (
	"log"
	"sync"

	"github.com/MikeDev101/cloudlink-phi/server/pkg/manager"
	"github.com/MikeDev101/cloudlink-phi/server/pkg/signaling/message"
	"github.com/MikeDev101/cloudlink-phi/server/pkg/structs"
	"github.com/gofiber/contrib/websocket"
	"github.com/oklog/ulid/v2"
)

// Open creates a new client session on the server. It creates a temporary
// ULID for the peer, creates a new client struct with the provided websocket
// connection, and adds the client to the specified game and default lobby.
// It returns the newly created client struct.
func Open(s *structs.Server, conn *websocket.Conn) *structs.Client {

	// Create client
	client := &structs.Client{
		Conn:     conn,
		ID:       ulid.Make().String(),
		Username: "",
		Session:  s.WebsocketConnCounter,
		UGI:      "", // Stub from original server code that I don't feel like refactoring out
		Mode:     0,
		Mux:      &sync.RWMutex{},
		Metadata: make(map[string]any),
	}

	// Increment counter
	s.WebsocketConnCounter++

	// Add entry with ULID as key and values
	manager.CreateSession(s, client)

	// Add client entry to games
	manager.AddClientToGame(s, "", client)

	// Join default lobby
	// manager.AddClientToLobby(s, "default", "", client)

	log.Printf("Created new session for peer %s (websocket ID %d)", client.ID, client.Session)
	return client
}

// Close terminates a client's session on the server. It handles the client
// leaving the lobby, notifying peers or transferring host responsibilities
// if the client is a host. If the client is a peer, it broadcasts a PEER_GONE
// message to other peers. If the client is a host, it examines lobby settings
// for host reclaim options and manages the lobby closure or host transfer process.
// Finally, it removes the client from the lobby and game, deletes the session,
// and closes client connections. Logs the closure of the session.
func Close(s *structs.Server, client *structs.Client) {
	if client == nil {
		log.Printf("Warning: Attempted to close nil client")
		return
	}

	PrepareToChangeModesOrDisconnect(s, client)

	// Remove from games
	manager.RemoveClientFromGame(s, client.UGI, client)

	// Clear session entry
	manager.DeleteSession(s, client)

	// Close the connection handler.
	if err := client.Conn.Close(); err != nil {
		panic(err)
	}

	if err := client.Conn.UnderlyingConn().Close(); err != nil {
		panic(err)
	}

	log.Printf("Closed session for peer %s (websocket ID %d)", client.ID, client.Session)
}

func PrepareToChangeModesOrDisconnect(s *structs.Server, client *structs.Client) {

	// Check if peer
	if client.AmIPeer() {

		// notify the host and members of the lobby that the peer is leaving
		members := manager.GetLobbyPeers(s, client.Lobby, client.UGI)
		members = manager.WithoutPeer(members, client)
		message.Broadcast(
			members,
			&structs.SignalPacket{
				Opcode: "PEER_GONE",
				Payload: &structs.PeerInfo{
					ID:   client.ID,
					User: client.Username,
				},
			},
		)

		leave_lobby(s, client)
	}

	// Check if host
	if client.AmIAHost() {

		// Read lobby settings
		settings := manager.GetLobbySettings(s, client.Lobby, client.UGI)
		if settings != nil {

			// Handle host reclaims if enabled
			if settings.AllowHostReclaim {
				if settings.AllowPeersToReclaim {
					// If peer-based host reclaim is enabled, ask all peers who wants to become the host.
					LeaveLobbyWithPeerBasedReclaim(s, client, settings)
				} else {
					// If server-based host reclaim is enabled, transfer ownership to the next available peer
					LeaveLobbyWithAutomatedReclaim(s, client, settings)
				}
			} else {
				// if reclaim is disabled, tell all peers that the lobby is closing and they need to leave, then destroy all connections and keys.
				LeaveAndDestroyLobby(s, client, settings)
			}
		}

	}

	// Clear the current mode and disassociate from lobbies
	client.ClearMode()
	client.SetLobby("")
}

func leave_lobby(s *structs.Server, client *structs.Client) {
	if client.AmINew() {
		manager.RemoveClientFromLobby(s, "default", client.UGI, client)
	} else {
		if client.AmIInALobby() {
			manager.RemoveClientFromLobby(s, client.Lobby, client.UGI, client)
		}
	}
}

func LeaveLobbyWithPeerBasedReclaim(s *structs.Server, client *structs.Client, settings *structs.LobbySettings) {
	// First, remove the current host
	manager.RemoveLobbyHost(s, client.Lobby, client.UGI, client)

	// Next, get all the current peers in the lobby, excluding the old host.
	peers := manager.GetLobbyPeers(s, client.Lobby, client.UGI)
	peers = manager.WithoutPeer(peers, client)

	// If there are no more peers, close the lobby.
	if len(peers) == 0 {

		// If the lobby has the server-side relay enabled, destroy the relay.
		if settings.UseServerRelay {
			manager.DeleteRelay(s, client)
		}

		// Destroy the lobby
		manager.DestroyLobby(s, client.UGI, client.Lobby)

	} else if len(peers) == 1 {

		// Re-assign the new host to the only peer left in the lobby
		manager.SetLobbyHost(s, client.Lobby, client.UGI, peers[0])
		peers[0].SetHostMode()
		message.Code(
			peers[0],
			"HOST_RECLAIM",
			&structs.PeerInfo{
				ID:   peers[0].ID,
				User: peers[0].Username,
			},
			"",
			nil,
		)

	} else {

		// Update the lobby settings so that no new peers may connect while the host is being transferred.
		settings.ReclaimInProgress = true
		manager.SetLobbySettings(s, client.Lobby, client.UGI, settings)

		// Broadcast the RECLAIM_HOST opcode to all peers.
		message.Broadcast(
			peers,
			&structs.SignalPacket{
				Opcode: "RECLAIM_HOST",
			},
		)
	}

	leave_lobby(s, client)
}

func LeaveLobbyWithAutomatedReclaim(s *structs.Server, client *structs.Client, settings *structs.LobbySettings) {
	// First, remove the current host
	manager.RemoveLobbyHost(s, client.Lobby, client.UGI, client)

	// Next, get all the current peers in the lobby, exclude the current host, and make the first one the new host
	peers := manager.GetLobbyPeers(s, client.Lobby, client.UGI)
	peers = manager.WithoutPeer(peers, client)

	// If there are no peers, close the lobby.
	if len(peers) == 0 {

		// If the lobby has the server-side relay enabled, destroy the relay.
		if settings.UseServerRelay {
			manager.DeleteRelay(s, client)
		}

		// Destroy the lobby
		manager.DestroyLobby(s, client.UGI, client.Lobby)

	} else {

		// Re-assign the new host
		manager.SetLobbyHost(s, client.Lobby, client.UGI, peers[0])

		// Tell all peers about the new host using the HOST_RECLAIM opcode.
		// This opcode is used to inform all clients of the new host.
		// The specific peer that is the new host will need to update their local state to reflect this as well.
		peers[0].SetHostMode()
		message.Broadcast(
			peers,
			&structs.SignalPacket{
				Opcode: "HOST_RECLAIM",
				Payload: &structs.PeerInfo{
					ID:   peers[0].ID,
					User: peers[0].Username},
			},
		)
	}

	leave_lobby(s, client)
}

func LeaveAndDestroyLobby(s *structs.Server, client *structs.Client, settings *structs.LobbySettings) {
	// If the lobby has the server-side relay enabled, destroy the relay.
	if settings.UseServerRelay {
		manager.DeleteRelay(s, client)
	}

	// Get all peers.
	peers := manager.GetLobbyPeers(s, client.Lobby, client.UGI)
	peers = manager.WithoutPeer(peers, client)

	// Notify that the host has left.
	message.Broadcast(
		peers,
		&structs.SignalPacket{
			Opcode: "HOST_GONE",
		},
	)

	// Remove the lobby host
	manager.RemoveClientFromLobby(s, client.Lobby, client.UGI, client)
	manager.RemoveLobbyHost(s, client.Lobby, client.UGI, client)

	// Destroy the lobby
	manager.DestroyLobby(s, client.UGI, client.Lobby)

	// Notify the peers that the lobby has closed
	message.Broadcast(
		peers,
		&structs.SignalPacket{
			Opcode: "LOBBY_CLOSE",
		},
	)

	// Close all peer connections to remove peers from the lobby
	for _, peer := range peers {
		Close(s, peer)
	}

	leave_lobby(s, client)
}
