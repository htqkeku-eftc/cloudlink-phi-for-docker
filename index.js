'use strict';

/*
CloudLink Phi Extension for Scratch 3.0

MIT License

Copyright (C) 2024 Mike Renaker "MikeDEV".

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

// CloudLink Phi
// ID: cloudlinkphi
// Description: Simply, Quickly, Easily.
// By: MikeDEV
// License: MIT
(function (Scratch2) {

    // Error handling for fatal issues
	function fatalAlert(message) {
		alert(message);
		throw new Error(message);
	}

	// Require the extension to be unsandboxed
	if (!Scratch2.extensions.unsandboxed) {
		fatalAlert("The CloudLink Phi extension cannot run sandboxed.");
	}

	// Require access to the VM and/or runtime
	if (!Scratch2.vm || !Scratch2.vm.runtime) {
		fatalAlert("The CloudLink Phi extension could not detect access to the Scratch VM and/or runtime. It's likely that this Scratch environment is not supported.");
	}

	// Require the browser to support WebRTC (used for connectivity)
	if (!RTCPeerConnection) {
		fatalAlert("The CloudLink Phi extension could not detect WebRTC support.");
	}

	// Require browser to support WebSockets (used for signaling)
	if (!WebSocket) {
		fatalAlert("The CloudLink Phi extension could not detect WebSocket support.");
	}

    // Require browser to support Web Locks API (used for concurrency)
    if (!navigator.locks) {
        fatalAlert("The CloudLink Phi extension could not detect Web Locks support.");
    }

    class Encryption {
        async generateKeyPair() {
            let keyPair = await window.crypto.subtle.generateKey(
                {
                    name: "ECDH",
                    namedCurve: "P-256"
                },
                true,
                ["deriveKey", "deriveBits"]
            );
            let publicKey = await this.exportPublicKey(keyPair.publicKey);
            let privateKey = await this.exportPrivateKey(keyPair.privateKey);
            return [publicKey, privateKey];
        }

        async exportPublicKey(pubKey) {
            let exportedKey = await window.crypto.subtle.exportKey("spki", pubKey);
            return this.arrayBufferToBase64(new Uint8Array(exportedKey));
        }

        async importPublicKey(exportedKey) {
            const exportedKeyArray = this.base64ToArrayBuffer(exportedKey);
            return await window.crypto.subtle.importKey(
                "spki",
                exportedKeyArray,
                {
                    name: "ECDH",
                    namedCurve: "P-256"
                },
                true,
                []
            );
        }

        async exportPrivateKey(privKey) {
            let exportedKey = await window.crypto.subtle.exportKey("pkcs8", privKey);
            return this.arrayBufferToBase64(new Uint8Array(exportedKey));
        }

        async importPrivateKey(exportedKey) {
            const exportedKeyArray = this.base64ToArrayBuffer(exportedKey);
            return await window.crypto.subtle.importKey(
                "pkcs8",
                exportedKeyArray,
                {
                    name: "ECDH",
                    namedCurve: "P-256"
                },
                true,
                ["deriveKey", "deriveBits"]
            );
        }

        async deriveSharedKey(publicKey, privateKey) {
            let pubkey = await this.importPublicKey(publicKey);
            let privkey = await this.importPrivateKey(privateKey);
            let shared = await window.crypto.subtle.deriveKey(
                {
                    name: "ECDH",
                    public: pubkey
                },
                privkey,
                {
                    name: "AES-GCM",
                    length: 256
                },
                true,
                ["encrypt", "decrypt"]
            );
            let exported = await this.exportSharedKey(shared);
            return exported;
        }

        async exportSharedKey(sharedKey) {
            let exportedKey = await window.crypto.subtle.exportKey("raw", sharedKey);
            return this.arrayBufferToBase64(new Uint8Array(exportedKey));
        }

        async importSharedKey(exportedKey) {
            const exportedKeyArray = this.base64ToArrayBuffer(exportedKey);
            return await window.crypto.subtle.importKey(
                "raw",
                exportedKeyArray,
                {
                    name: "AES-GCM",
                    length: 256
                },
                true,
                ["encrypt", "decrypt"]
            );
        }

        async encrypt(message, sharedKey) {
            let shared = await this.importSharedKey(sharedKey);
            let encodedMessage = new TextEncoder().encode(message);
            const iv = window.crypto.getRandomValues(new Uint8Array(12));
            const encryptedMessage = await window.crypto.subtle.encrypt(
                {
                    name: "AES-GCM",
                    iv: iv
                },
                shared,
                encodedMessage
            );
            const encryptedMessageArray = new Uint8Array(encryptedMessage);
            const encryptedMessageBase64 = this.arrayBufferToBase64(encryptedMessageArray);
            const ivBase64 = this.arrayBufferToBase64(iv);
            return [encryptedMessageBase64, ivBase64];
        }

        async decrypt(encryptedMessageBase64, ivBase64, sharedKey) {
            let shared = await this.importSharedKey(sharedKey);
            let encryptedMessageArray = this.base64ToArrayBuffer(encryptedMessageBase64);
            const iv = this.base64ToArrayBuffer(ivBase64);
            const decryptedMessage = await window.crypto.subtle.decrypt(
                {
                    name: "AES-GCM",
                    iv: iv
                },
                shared,
                encryptedMessageArray
            );
            const decodedMessage = new TextDecoder().decode(decryptedMessage);
            return decodedMessage;
        }

        arrayBufferToBase64(buffer) {
            let binary = '';
            let bytes = new Uint8Array(buffer);
            for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            return btoa(binary);
        }

        base64ToArrayBuffer(base64) {
            let binary_string = window.atob(base64);
            let len = binary_string.length;
            let bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binary_string.charCodeAt(i);
            }
            return bytes.buffer;
        }
    }

    class PhiClient {
        constructor() {

            // Config
            this.stun_url = "stun:vpn.mikedev101.cc:5349";
            this.turn_url = "turn:vpn.mikedev101.cc:5349";
            this.turn_username = "free";
            this.turn_password = "free";
            this.turn_only = false;

            // Metadata
            this.metadata = {
                client_type: "phi",
                client_version: "1.0.0",
                protocol_version: "1",
                signaling_version: "1.2",
                user_agent: window.navigator.userAgent,
                encryption_suite: "ECDH-P256-AES-GCM",
                key_exchange_mode: "SPKI-BASE64",
            };

            // State
            this.peers = new Map();
            this.messageCallbacks = new Map();
            this.eventCallbacks = new Map();
            this.peerConnectedEvents = new Map();
            this.peerDisconnectedEvents = new Map();
            this.seenPeers = new Map();
            this.id = null;
            this.session = null;
            this.username = null;
            this.peerNewEvent = null;
            this.peerSupportsEncryptionEvent = null;
            this.peerMadeOwnerEvent = null;
            this.connectedEvent = null;
            this.modeChangeEvent = null;
            this.disconnectedEvent = null;
            this.usernameSetEvent = null;
            this.fetchedLobbyListEvent = null;
            this.keepalive = false;
            this.usernameSet = false;

            // Flags
            this.relayEnabled = false;
            this.enableKeepalive = false;
            this.mode = 0; // 0 - none, 1 - host, 2 - peer

            // End-to-end Encryption Support
            this.encryption = new Encryption();
            this.publicKey = "";
            this.privateKey = "";
        }

        Connect(url) {
            const self = this;
            if (self.socket) return;

            self.socket = new WebSocket(url);

            self.socket.onopen = async () => {
                // Generate public and private keys for end-to-end encryption
                [self.publicKey, self.privateKey] = await self.encryption.generateKeyPair();
                self.sendSignalingMessage("META", self.metadata, null);
                if (self.connectedEvent) self.connectedEvent();

                if (self.enableKeepalive) {
                    self.sendSignalingMessage("KEEPALIVE", null, null);
                }
            };

            self.socket.onmessage = async (event) => await self.handleSignalingMessage(JSON.parse(event.data));

            self.socket.onerror = (error) => console.error("WebSocket error:", error);

            self.socket.onclose = async () => {
                self.Close();
                if (self.disconnectedEvent) self.disconnectedEvent();
            }
        }

        SetUsername(username) {
            const self = this;
            if (!self.socket || self.socket.readyState != WebSocket.OPEN) return;
            if (self.username) return;
            self.username = username;
            self.sendSignalingMessage("INIT", username, null);
        }

        FetchRoomList() {
            const self = this;
            self.sendSignalingMessage("LOBBY_LIST", null, null)
        }

        OnLobbyList(callback) {
            const self = this;
            self.fetchedLobbyListEvent = callback;
        }

        WhenConnected(callback) {
            const self = this;
            self.connectedEvent = callback;
        }

        WhenDisconnected(callback) {
            const self = this;
            self.disconnectedEvent = callback;
        }

        OnNewPeer(callback) {
            const self = this;
            self.peerNewEvent = callback;
        }

        WhenUsernameSet(callback) {
            const self = this;
            self.usernameSetEvent = callback;
        }

        WhenPeerSupportsEncryption(callback) {
            const self = this;
            self.peerSupportsEncryptionEvent = callback;
        }

        WhenChangingMode(callback) {
            const self = this;
            self.modeChangeEvent = callback;
        }

        OnOwnershipChange(callback) {
            const self = this;
            self.peerMadeOwnerEvent = callback;
        }

        OnPeerMessage(peer, callback) {
            const self = this;
            self.messageCallbacks.set(peer, callback);
        }

        OnPeerConnected(peer, callback) {
            const self = this;
            self.peerConnectedEvents.set(peer, callback);
        }

        OnPeerDisconnected(peer, callback) {
            const self = this;
            self.peerDisconnectedEvents.set(peer, callback);
        }

        BindEvent(opcode, callback) {
            const self = this;
            self.eventCallbacks.set(opcode, callback);
        }

        FireSeenPeerEvent(peer, opcode) {
            const self = this;
            if (!self.seenPeers.has(peer.id)) return;
            if (!self.peerNewEvent) return;
            if (self.seenPeers.get(peer.id)) return;
            if (peer.id === "relay" && !self.relayEnabled) self.relayEnabled = true;
            self.seenPeers.set(peer.id, true);
            self.peerNewEvent(peer, opcode);
        }

        async createConnection(peerId, username, pubKey = null) {
            const self = this;

            if (self.peers.has(peerId)) {
                throw new Error(`Connection with peer ${username} (${peerId}) already exists`);
            }
            if (!peerId) {
                throw new Error(`Got a null peerId`);
            }
            if (!username) {
                throw new Error(`Got a null username`);
            }

            let sharedKey = null;
            if (pubKey) {
                sharedKey = await self.encryption.deriveSharedKey(pubKey, self.privateKey);
                if (self.peerSupportsEncryptionEvent) self.peerSupportsEncryptionEvent({user: username, id: peerId});
            }

            const peerConnection = {
                conn: new RTCPeerConnection({
                    iceServers: [
                        { urls: this.stun_url },
                        { urls: this.turn_url, username: this.turn_username, credential: this.turn_password },
                    ],
                    iceTransportPolicy: (this.turn_only ? "relay" : "all"),
                }),
                username,
                sharedKey,
                dataChannels: new Map(),
            }

            const dataChannel = peerConnection.conn.createDataChannel("default", { protocol: "clomega", negotiated: true, id: 0, ordered: true });
            peerConnection.dataChannels.set("default", dataChannel);
            self.bindChannelHandlers(dataChannel, peerId);

            peerConnection.conn.ondatachannel = (event) => {
                const dataChannel = event.channel;
                if (peerConnection.dataChannels.has(dataChannel.label)) return;
                peerConnection.dataChannels.set(dataChannel.label, dataChannel);
                self.bindChannelHandlers(dataChannel, peerId);
            }

            peerConnection.conn.onconnectionstatechange = async () => {
                switch (peerConnection.conn.connectionState) {
                    case "closed":
                    case "disconnected":
                        console.log(`Disconnected from peer ${peerId} (${username})`);
                        break;
                    case "connected":
                        console.log(`Connected to peer ${peerId} (${username})`);
                        break;
                    case "failed":
                        console.log(`Failed to connect to peer ${peerId} (${username})`);
                        await self.closeConnection(peerId);
                        break;
                }
            }

            peerConnection.conn.onicecandidate = async(event) => {
                if (event.candidate) {
                    if (peerConnection.sharedKey) {
                        let [encrypted, iv] = await self.encryption.encrypt(JSON.stringify(event.candidate), peerConnection.sharedKey);
                        self.sendSignalingMessage("ICE", { type: 0, contents: [encrypted, iv]}, peerId);
                    } else {
                        self.sendSignalingMessage("ICE", { type: 0, contents: event.candidate }, peerId);
                    }
                }
            }

            self.peers.set(peerId, peerConnection);
            self.seenPeers.set(peerId, false);
            return peerConnection;
        }

        bindChannelHandlers(dataChannel, peerId) {
            const self = this;

            dataChannel.onopen = () => {
                if (self.peerConnectedEvents.has(peerId)) self.peerConnectedEvents.get(peerId)();
            }

            dataChannel.onclose = async () =>  {
                await self.closeConnection(peerId);
            }

            dataChannel.onmessage = async (event) => {
                let packet = JSON.parse(event.data);
                let relayed = false;
                let originPeer = peerId;
                if (packet.origin) {
                    originPeer = packet.origin.id;
                    relayed = true;
                }
                if (!self.peers.has(originPeer)) {
                    throw new Error(`Peer ${originPeer} not found.`);
                };
                let pc = self.peers.get(originPeer);
                if (pc.sharedKey) { 
                    packet.payload = await this.encryption.decrypt(packet.payload[0], packet.payload[1], pc.sharedKey);
                    console.log(packet.payload);
                }
                if (self.messageCallbacks.has(originPeer)) self.messageCallbacks.get(originPeer)(dataChannel.label, packet.payload, relayed);
            }
        }

        // Create an offer and send it to the signaling server
        async createOffer(peerId) {
            const self = this;
            if (!self.peers.has(peerId)) {
                throw new Error(`No peer connection found for ${peerId}`);
            }
            const peerConnection = self.peers.get(peerId);
            const offer = await peerConnection.conn.createOffer();
            await peerConnection.conn.setLocalDescription(offer);
            if (peerConnection.sharedKey) {
                let [encrypted, iv] = await self.encryption.encrypt(JSON.stringify(offer), peerConnection.sharedKey);
                self.sendSignalingMessage("MAKE_OFFER", { type: 0, contents: [encrypted, iv]}, peerId);
            } else {
                self.sendSignalingMessage("MAKE_OFFER", { type: 0, contents: offer }, peerId);
            }
        }

        // Create an answer in response to an offer
        async createAnswer(peerId, offer) {
            const self = this;
            if (!self.peers.has(peerId)) {
                throw new Error(`No peer connection found for ${peerId}`);
            }
            const peerConnection = self.peers.get(peerId);
            if (peerConnection.sharedKey) { 
                offer = JSON.parse(await self.encryption.decrypt(offer[0], offer[1], peerConnection.sharedKey));
            }
            await peerConnection.conn.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await peerConnection.conn.createAnswer();
            await peerConnection.conn.setLocalDescription(answer);
            if (peerConnection.sharedKey) {
                let [encrypted, iv] = await self.encryption.encrypt(JSON.stringify(answer), peerConnection.sharedKey);
                self.sendSignalingMessage("MAKE_ANSWER", { type: 0, contents: [encrypted, iv]}, peerId);
            } else {
                self.sendSignalingMessage("MAKE_ANSWER", { type: 0, contents: answer }, peerId);
            }
        }

        async handleOffer(peerId, offer) {
            const self = this;
            if (!self.peers.has(peerId)) {
                throw new Error(`No connection found for peer ${peerId}`);
            }
            const peerConnection = self.peers.get(peerId);
            if (peerConnection.sharedKey) { 
                offer = JSON.parse(await self.encryption.decrypt(offer[0], offer[1], peerConnection.sharedKey));
            }
            await peerConnection.conn.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await peerConnection.conn.createAnswer();
            await peerConnection.conn.setLocalDescription(answer);
            if (peerConnection.sharedKey) {
                let [encrypted, iv] = await self.encryption.encrypt(JSON.stringify(answer), peerConnection.sharedKey);
                self.sendSignalingMessage("MAKE_ANSWER", { type: 0, contents: [encrypted, iv]}, peerId);
            } else {
                self.sendSignalingMessage("MAKE_ANSWER", { type: 0, contents: answer }, peerId);
            }
        }

        async handleAnswer(peerId, answer) {
            const self = this;
            if (!self.peers.has(peerId)) {
                throw new Error(`No connection found for peer ${peerId}`);
            }
            const peerConnection = self.peers.get(peerId);
            if (peerConnection.sharedKey) { 
                answer = JSON.parse(await self.encryption.decrypt(answer[0], answer[1], peerConnection.sharedKey));
            }
            await peerConnection.conn.setRemoteDescription(new RTCSessionDescription(answer));
        }

        async handleICECandidate(peerId, candidate) {
            const self = this;
            if (!self.peers.has(peerId)) {
                throw new Error(`No connection found for peer ${peerId}`);
            }
            const peerConnection = self.peers.get(peerId);
            if (peerConnection.sharedKey) { 
                candidate = JSON.parse(await self.encryption.decrypt(candidate[0], candidate[1], peerConnection.sharedKey));
            }
            await peerConnection.conn.addIceCandidate(new RTCIceCandidate(candidate));
        }

        sendMessage(peerId, channel, opcode, data, relay = false) {
            const self = this;
            if (!self.peers.has(peerId)) {
                throw new Error(`No connection found for peer ${peerId}`);
            }
            if (!["object", "string", "number"].includes(typeof data) && !Array.isArray(data)) {
                throw new Error("Payload must be an Object, Array, Number, or String.");
            }
            let packet = { opcode };
            if (relay) {
                if (!self.relayEnabled) {
                    throw new Error(`Can't use server-side relay since no relay peer was detected`);
                }
                packet.recipient = peerId;
                peerId = "relay";
            }
            const peerConnection = self.peers.get(peerId);
            if (!peerConnection.dataChannels.has(channel)) {
                throw new Error(`Data channel ${channel} not found with peer ${peerConnection.username} (${peerId})`)
            }
            const dataChannel = peerConnection.dataChannels.get(channel);
            if (dataChannel.readyState !== "open") {
                throw new Error(`Data channel ${channel} with ${peerConnection.username} (${peerId}) is not open.`);
            }
            if (peerConnection.sharedKey) {
                self.encryption.encrypt(JSON.stringify(payload), peerConnection.sharedKey).then(([encrypted, iv]) => {
                    packet.payload = [encrypted, iv];
                    dataChannel.send(JSON.stringify(packet));
                }).catch((error) => {
                    console.error(`Failed to encrypt payload for peer ${peerId}:`, error);
                });
            } else {
                packet.payload = data;
                dataChannel.send(JSON.stringify(packet));
            }
        }

        async closeConnection(peerId) {
            const self = this;
            return navigator.locks.request(peerId, () => {
                if (self.peers.has(peerId)) {
                    const peerConnection = self.peers.get(peerId);
                    console.log(`Closing connection with peer ${peerConnection.username} (${peerId})`);
                    peerConnection.dataChannels.forEach((dataChannel, channelId) => {
                        dataChannel.close();
                    });
                    peerConnection.conn.close();
                    self.peers.delete(peerId);
                    if (self.peerDisconnectedEvents.has(peerId)) self.peerDisconnectedEvents.get(peerId)();
                }
            });
        }

        sendSignalingMessage(opcode, payload, recipient) {
            const self = this;
            let packet = { opcode };
            if (payload) packet.payload = payload;
            if (recipient) packet.recipient = recipient;
            self.socket.send(JSON.stringify(packet));
        }

        async handleSignalingMessage(message) {
            const self = this;
            const { opcode, payload, origin } = message;
            switch (opcode) {

                // Session ready
                case "INIT_OK":
                    self.id = payload.id;
                    self.session = payload.session_id;
                    self.usernameSet = true;
                    if (self.usernameSetEvent) self.usernameSetEvent(payload);
                    break;

                // Keep alive
                case "KEEPALIVE":
                    self.keepalive = setTimeout(() => {
                        self.sendSignalingMessage("KEEPALIVE", null, null);
                    }, 5000) // 5 seconds delay
                    break;

                // Return list of open rooms
                case "LOBBY_LIST":
                    if (self.fetchedLobbyListEvent) self.fetchedLobbyListEvent(payload);
                    break;

                // Set mode
                case "ACK_HOST":
                    self.mode = 1;
                    break;
                case "ACK_PEER":
                    self.mode = 2;
                    break;

                // Do nothing
                case "ACK_META":
                case "RELAY_OK":
                case "PASSWORD_ACK":
                case "NEW_HOST":
                case "WARNING":
                case "LOBBY_NOTFOUND":
                case "LOBBY_FULL":
                case "LOBBY_LOCKED":
                case "PASSWORD_REQUIRED":
                case "PASSWORD_FAIL":
                case "LOBBY_EXISTS":
                case "ALREADY_HOST":
                case "ALREADY_PEER":
                    break;

                // Room ownership has changed
                case "HOST_RECLAIM":
                    if (payload.id === self.id) {
                        if (self.peerMadeOwnerEvent) self.peerMadeOwnerEvent();
                    }
                    break;
                
                // Close connections
                case "PEER_GONE":
                    await self.closeConnection(payload.id);
                    break;
                case "HOST_GONE":
                    await self.closeConnection(payload.id);
                    break;
                case "LOBBY_CLOSE":
                    self.Close();
                    break;
                case "TRANSITION":
                    console.log(`Changing to ${payload} mode...`);
                    self.mode = (payload == "host" ? 1 : 2);
                    self.peers.forEach(async (_, peerId) => {
                        await self.closeConnection(peerId);
                    });
                    self.sendSignalingMessage("TRANSITION_ACK", null, null);
                    if (self.modeChangeEvent) self.modeChangeEvent(payload);
                    break;
                
                // Prepare connections
                case "NEW_PEER":
                    return navigator.locks.request(payload.id, async () => {
                        await self.createConnection(payload.id, payload.user, payload.pubkey)
                        await self.createOffer(payload.id);
                        self.FireSeenPeerEvent(payload, opcode);
                    })

                case "ANTICIPATE":
                    return navigator.locks.request(payload.id, async () => {
                        await self.handleAnticipate(payload);
                        self.FireSeenPeerEvent(payload, opcode);
                    })

                case "DISCOVER":
                    return navigator.locks.request(payload.id, async () => {
                        await self.handleDiscover(payload);
                        self.FireSeenPeerEvent(payload, opcode);
                    })
                
                // Process offer
                case "MAKE_OFFER":
                    return navigator.locks.request(origin.id, async () => {
                        await self.handleOffer(origin.id, payload.contents);
                        self.FireSeenPeerEvent(origin, opcode);
                    })
                
                // Process answer
                case "MAKE_ANSWER":
                    return navigator.locks.request(origin.id, async () => {
                        await self.handleAnswer(origin.id, payload.contents);
                    })
                
                // Process ICE
                case "ICE":
                    return navigator.locks.request(origin.id, async () => {
                        await self.handleICECandidate(origin.id, payload.contents);
                    })
                
                // Errors
                case "VIOLATION":
                    console.error("Protocol Violation:", payload);
                    self.Close();
                    break;
                default:
                    console.warn(`Unknown signaling message type: ${opcode}`);
            }

            if (self.eventCallbacks.has(opcode)) self.eventCallbacks.get(opcode)(payload, origin);
        }

        async MakeRoom(name, password, limit, relay) {
            const self = this;
            if (!self.username) return;
            let payload = {
                lobby_id: name,
                allow_host_reclaim: true,
                allow_peers_to_claim_host: false,
                max_peers: limit,
                password: password,
                use_server_relay: relay,
            };
            if (self.publicKey) payload.pubkey = self.publicKey;
            self.sendSignalingMessage("CONFIG_HOST", payload, null);
        }

        async JoinRoom(name, password) {
            const self = this;
            if (!self.username) return;
            let payload = {
                lobby_id: name,
                password: password,
            };
            if (self.publicKey) payload.pubkey = self.publicKey;
            self.sendSignalingMessage("CONFIG_PEER", payload, null);
        }

        async handleAnticipate(payload) {
            const self = this;
            const { user, id, pubkey } = payload;
            await self.createConnection(id, user, pubkey);
        }

        async handleDiscover(payload) {
            const self = this;
            const { user, id, pubkey } = payload;
            await self.createConnection(id, user, pubkey);
            await self.createOffer(id);
        }

        Close() {
            const self = this;
            clearTimeout(self.keepalive);
            self.peers.forEach(async (_, peerId) => {
                await self.closeConnection(peerId);
            });
            self.relayEnabled = false;
            self.usernameSet = false;
            self.username = null;
            self.id = null;
            self.mode = 0;
            if (self.socket) {
                if (self.socket.readyState === WebSocket.OPEN) self.socket.close();
                self.socket = null;
            }
        }
    }

    class CloudLinkPhi {
        constructor(vm) {
            this.vm = vm;
            this.client = new PhiClient();

            this.client.WhenConnected(() => {
                this.vm.runtime.startHats("cloudlinkphi_on_signalling_connect");
            })

            this.client.WhenUsernameSet((session) => {
                this.vm.runtime.startHats("cloudlinkphi_on_signalling_login");
                this.client.FetchRoomList();
            })

            this.client.OnLobbyList((rooms) => {
                // logMessage(`There are ${rooms.length} room(s) open. ${JSON.stringify(rooms)}`);
            })

            this.client.WhenDisconnected(() => {
                this.vm.runtime.startHats("cloudlinkphi_on_signalling_disconnect");
            })

            this.client.BindEvent("ACK_HOST", (data) => {
                //  logMessage(`Created room.`);
            })

            this.client.WhenChangingMode((mode) => {
                // logMessage(`Transitioning into ${mode} mode....`);
            })

            this.client.BindEvent("ACK_PEER", (data) => {
                // logMessage(`Joined room.`);
            })

            this.client.OnOwnershipChange(() => {
                // logMessage("Room ownership has changed. This client is now the owner.");
            })

            this.client.WhenPeerSupportsEncryption((origin) => {
                // logMessage(`${origin.user} (${origin.id}) supports E2EE.`);
            })

            this.client.OnNewPeer((origin, opcode) => {
                // logMessage(`Got new peer ${origin.user} (${origin.id}) using ${opcode}.`);
                this.client.OnPeerConnected(origin.id, () => {
                    // logMessage(`${origin.user} (${origin.id}) has connected.`);
                })
                this.client.OnPeerDisconnected(origin.id, () => {
                    // logMessage(`${origin.user} (${origin.id}) has disconnected.`);
                })
                this.client.OnPeerMessage(origin.id, (channel, data, relayed) => {
                    // logMessage(`Got packet from ${origin.user} (${origin.id}) in channel ${channel} (was relayed? ${relayed}): ${data}`);
                })
            })
        }

        getInfo() {
            return {
                id: "cloudlinkphi",
                name: "CloudLink Φ",
                menuIconURI: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjI2IiBoZWlnaHQ9IjIyNiIgdmlld0JveD0iMCAwIDIyNiAyMjYiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxnIGNsaXAtcGF0aD0idXJsKCNjbGlwMF8xODFfMTM4KSI+CjxwYXRoIGQ9Ik0wIDExMi42NzdDMCA1MC40NDc0IDUwLjQ0NzQgMCAxMTIuNjc3IDBDMTc0LjkwNyAwIDIyNS4zNTUgNTAuNDQ3NCAyMjUuMzU1IDExMi42NzdDMjI1LjM1NSAxNzQuOTA3IDE3NC45MDcgMjI1LjM1NSAxMTIuNjc3IDIyNS4zNTVDNTAuNDQ3NCAyMjUuMzU1IDAgMTc0LjkwNyAwIDExMi42NzdaIiBmaWxsPSIjRkY5NDAwIi8+CjxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNMTU5LjAxNiA4My42MTYzQzE4Mi4yMDUgODMuNjE2MyAyMDEgMTAyLjUwNiAyMDEgMTI1LjgwOEMyMDEgMTQ5LjExIDE4Mi4yMDUgMTY4IDE1OS4wMTYgMTY4SDY2Ljk4MzhDNDMuNzk1NSAxNjggMjUgMTQ5LjExIDI1IDEyNS44MDhDMjUgMTAyLjUwNiA0My43OTU1IDgzLjYxNjMgNjYuOTgzOCA4My42MTYzSDcxLjE2MzJDNzIuOTcwNyA2MS45ODc4IDkxLjAxMTkgNDUgMTEzIDQ1QzEzNC45ODggNDUgMTUzLjAyOSA2MS45ODc4IDE1NC44MzcgODMuNjE2M0gxNTkuMDE2WiIgZmlsbD0id2hpdGUiLz4KPHBhdGggZD0iTTEwOC4wNDMgMTQ4VjEzOS45NjJDMTAyLjUzMyAxMzkuODU1IDk4LjAxMjMgMTM5LjEwNCA5NC40ODE1IDEzNy43MTFDOTAuOTUwNiAxMzYuMjY0IDg4LjE5NTUgMTM0LjQxNiA4Ni4yMTYgMTMyLjE2NUM4NC4yMzY2IDEyOS45MTQgODIuODcyNCAxMjcuNTAzIDgyLjEyMzUgMTI0LjkzMUM4MS4zNzQ1IDEyMi4zNTggODEgMTE5Ljg2NiA4MSAxMTcuNDU1QzgxIDExNC42NjggODEuNDI4IDExMS45ODkgODIuMjg0IDEwOS40MTdDODMuMTM5OSAxMDYuNzkxIDg0LjU4NDQgMTA0LjQzMyA4Ni42MTczIDEwMi4zNDNDODguNjUwMiAxMDAuMjUzIDkxLjQwNTMgOTguNTkyMiA5NC44ODI3IDk3LjM1OTdDOTguMzYwMSA5Ni4wNzM2IDEwMi43NDcgOTUuMzc2OSAxMDguMDQzIDk1LjI2OThWODlIMTE4Ljk1N1Y5NS4yNjk4QzEyNC4yNTMgOTUuMzc2OSAxMjguNjQgOTYuMDczNiAxMzIuMTE3IDk3LjM1OTdDMTM1LjU5NSA5OC41OTIyIDEzOC4zNSAxMDAuMjUzIDE0MC4zODMgMTAyLjM0M0MxNDIuNDE2IDEwNC40MzMgMTQzLjg2IDEwNi43OTEgMTQ0LjcxNiAxMDkuNDE3QzE0NS41NzIgMTExLjk4OSAxNDYgMTE0LjY2OCAxNDYgMTE3LjQ1NUMxNDYgMTE5Ljg2NiAxNDUuNTk5IDEyMi4zODUgMTQ0Ljc5NiAxMjUuMDExQzE0My45OTQgMTI3LjU4MyAxNDIuNjAzIDEyOS45OTUgMTQwLjYyMyAxMzIuMjQ1QzEzOC42OTggMTM0LjQ0MiAxMzUuOTY5IDEzNi4yNjQgMTMyLjQzOCAxMzcuNzExQzEyOC45MDcgMTM5LjEwNCAxMjQuNDE0IDEzOS44NTUgMTE4Ljk1NyAxMzkuOTYyVjE0OEgxMDguMDQzWk0xMDguMDQzIDEzMC41NTdWMTA0Ljc1NUMxMDMuNzYzIDEwNC45MTYgMTAwLjUgMTA1LjU4NSA5OC4yNTMxIDEwNi43NjRDOTYuMDA2MiAxMDcuOTQzIDk0LjQ1NDcgMTA5LjQ3IDkzLjU5ODggMTExLjM0NkM5Mi43OTYzIDExMy4xNjggOTIuMzk1MSAxMTUuMTc4IDkyLjM5NTEgMTE3LjM3NUM5Mi4zOTUxIDExOS43ODYgOTIuODQ5OCAxMjEuOTU2IDkzLjc1OTMgMTIzLjg4NkM5NC42Njg3IDEyNS44MTUgOTYuMjQ2OSAxMjcuMzY5IDk4LjQ5MzggMTI4LjU0OEMxMDAuNzk0IDEyOS43MjcgMTAzLjk3NyAxMzAuMzk2IDEwOC4wNDMgMTMwLjU1N1pNMTE4Ljk1NyAxMzAuNTU3QzEyMy4wMjMgMTMwLjM5NiAxMjYuMTc5IDEyOS43MjcgMTI4LjQyNiAxMjguNTQ4QzEzMC43MjYgMTI3LjM2OSAxMzIuMzMxIDEyNS44MTUgMTMzLjI0MSAxMjMuODg2QzEzNC4xNSAxMjEuOTU2IDEzNC42MDUgMTE5Ljc4NiAxMzQuNjA1IDExNy4zNzVDMTM0LjYwNSAxMTUuMTc4IDEzNC4xNzcgMTEzLjE2OCAxMzMuMzIxIDExMS4zNDZDMTMyLjUxOSAxMDkuNDcgMTMwLjk5NCAxMDcuOTQzIDEyOC43NDcgMTA2Ljc2NEMxMjYuNSAxMDUuNTg1IDEyMy4yMzcgMTA0LjkxNiAxMTguOTU3IDEwNC43NTVWMTMwLjU1N1oiIGZpbGw9IiNGRjk0MDAiLz4KPC9nPgo8ZGVmcz4KPGNsaXBQYXRoIGlkPSJjbGlwMF8xODFfMTM4Ij4KPHJlY3Qgd2lkdGg9IjIyNS4zNTUiIGhlaWdodD0iMjI1LjM1NSIgZmlsbD0id2hpdGUiLz4KPC9jbGlwUGF0aD4KPC9kZWZzPgo8L3N2Zz4K",
                blockIconURI: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTc3IiBoZWlnaHQ9IjEyMyIgdmlld0JveD0iMCAwIDE3NyAxMjMiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxnIGNsaXAtcGF0aD0idXJsKCNjbGlwMF8xODFfMTQ0KSI+CjxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNMTM0LjAxNiA0Mi42MTYzQzE1Ny4yMDUgNDIuNjE2MyAxNzYgNjEuNTA2MyAxNzYgODQuODA4MUMxNzYgMTA4LjExIDE1Ny4yMDUgMTI3IDEzNC4wMTYgMTI3SDQxLjk4MzhDMTguNzk1NSAxMjcgMCAxMDguMTEgMCA4NC44MDgxQzAgNjEuNTA2MyAxOC43OTU1IDQyLjYxNjMgNDEuOTgzOCA0Mi42MTYzSDQ2LjE2MzJDNDcuOTcwNyAyMC45ODc4IDY2LjAxMTkgNCA4OCA0QzEwOS45ODggNCAxMjguMDI5IDIwLjk4NzggMTI5LjgzNyA0Mi42MTYzSDEzNC4wMTZaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNODMuMDQzMiAxMDdWOTguOTYxOUM3Ny41MzI5IDk4Ljg1NDcgNzMuMDEyMyA5OC4xMDQ1IDY5LjQ4MTUgOTYuNzExMkM2NS45NTA2IDk1LjI2NDMgNjMuMTk1NSA5My40MTU1IDYxLjIxNiA5MS4xNjQ4QzU5LjIzNjYgODguOTE0MiA1Ny44NzI0IDg2LjUwMjcgNTcuMTIzNSA4My45MzA1QzU2LjM3NDUgODEuMzU4MyA1NiA3OC44NjY1IDU2IDc2LjQ1NUM1NiA3My42Njg1IDU2LjQyOCA3MC45ODkxIDU3LjI4NCA2OC40MTY5QzU4LjEzOTkgNjUuNzkxMSA1OS41ODQ0IDYzLjQzMzIgNjEuNjE3MyA2MS4zNDMzQzYzLjY1MDIgNTkuMjUzNCA2Ni40MDUzIDU3LjU5MjIgNjkuODgyNyA1Ni4zNTk3QzczLjM2MDEgNTUuMDczNiA3Ny43NDY5IDU0LjM3NjkgODMuMDQzMiA1NC4yNjk4VjQ4SDkzLjk1NjhWNTQuMjY5OEM5OS4yNTMxIDU0LjM3NjkgMTAzLjY0IDU1LjA3MzYgMTA3LjExNyA1Ni4zNTk3QzExMC41OTUgNTcuNTkyMiAxMTMuMzUgNTkuMjUzNCAxMTUuMzgzIDYxLjM0MzNDMTE3LjQxNiA2My40MzMyIDExOC44NiA2NS43OTExIDExOS43MTYgNjguNDE2OUMxMjAuNTcyIDcwLjk4OTEgMTIxIDczLjY2ODUgMTIxIDc2LjQ1NUMxMjEgNzguODY2NSAxMjAuNTk5IDgxLjM4NTEgMTE5Ljc5NiA4NC4wMTA5QzExOC45OTQgODYuNTgzMSAxMTcuNjAzIDg4Ljk5NDUgMTE1LjYyMyA5MS4yNDUyQzExMy42OTggOTMuNDQyMyAxMTAuOTY5IDk1LjI2NDMgMTA3LjQzOCA5Ni43MTEyQzEwMy45MDcgOTguMTA0NSA5OS40MTM2IDk4Ljg1NDcgOTMuOTU2OCA5OC45NjE5VjEwN0g4My4wNDMyWk04My4wNDMyIDg5LjU1NzJWNjMuNzU0OEM3OC43NjM0IDYzLjkxNTUgNzUuNSA2NC41ODU0IDczLjI1MzEgNjUuNzY0M0M3MS4wMDYyIDY2Ljk0MzIgNjkuNDU0NyA2OC40NzA1IDY4LjU5ODggNzAuMzQ2MUM2Ny43OTYzIDcyLjE2OCA2Ny4zOTUxIDc0LjE3NzYgNjcuMzk1MSA3Ni4zNzQ3QzY3LjM5NTEgNzguNzg2MSA2Ny44NDk4IDgwLjk1NjQgNjguNzU5MyA4Mi44ODU2QzY5LjY2ODcgODQuODE0NyA3MS4yNDY5IDg2LjM2ODggNzMuNDkzOCA4Ny41NDc3Qzc1Ljc5NDIgODguNzI2NiA3OC45Nzc0IDg5LjM5NjUgODMuMDQzMiA4OS41NTcyWk05My45NTY4IDg5LjU1NzJDOTguMDIyNiA4OS4zOTY1IDEwMS4xNzkgODguNzI2NiAxMDMuNDI2IDg3LjU0NzdDMTA1LjcyNiA4Ni4zNjg4IDEwNy4zMzEgODQuODE0NyAxMDguMjQxIDgyLjg4NTZDMTA5LjE1IDgwLjk1NjQgMTA5LjYwNSA3OC43ODYxIDEwOS42MDUgNzYuMzc0N0MxMDkuNjA1IDc0LjE3NzYgMTA5LjE3NyA3Mi4xNjggMTA4LjMyMSA3MC4zNDYxQzEwNy41MTkgNjguNDcwNSAxMDUuOTk0IDY2Ljk0MzIgMTAzLjc0NyA2NS43NjQzQzEwMS41IDY0LjU4NTQgOTguMjM2NiA2My45MTU1IDkzLjk1NjggNjMuNzU0OFY4OS41NTcyWiIgZmlsbD0iI0ZGOTQwMCIvPgo8L2c+CjxkZWZzPgo8Y2xpcFBhdGggaWQ9ImNsaXAwXzE4MV8xNDQiPgo8cmVjdCB3aWR0aD0iMTc2LjM5OSIgaGVpZ2h0PSIxMjIuNjcxIiBmaWxsPSJ3aGl0ZSIvPgo8L2NsaXBQYXRoPgo8L2RlZnM+Cjwvc3ZnPgo=",
                color1: '#FF9400',
                color2: '#FFAD73',
                color3: '#A16132',
                blocks: [
                    {
						opcode: "extension_version",
						blockType: Scratch2.BlockType.REPORTER,
						text: "Client version",
					},
					{
						opcode: "api_version",
						blockType: Scratch2.BlockType.REPORTER,
						text: "Signaling version",
					},
					{
						opcode: "protocol_version",
						blockType: Scratch2.BlockType.REPORTER,
						text: "Protocol version",
					},

                    "---",

                    {
                        blockType: Scratch2.BlockType.LABEL,
                        text: '🔧 Configuration'
                    },
                    {
                        opcode: "isKeepaliveOn",
                        blockType: Scratch2.BlockType.BOOLEAN,
                        text: "Is keepalive enabled?"
                    },
                    {
                        opcode: "isTurnOnlyModeOn",
                        blockType: Scratch2.BlockType.BOOLEAN,
                        text: "Am I only using TURN?"
                    },
                    {
                        opcode: "changeKeepalive",
                        blockType: Scratch2.BlockType.COMMAND,
                        text: "Keepalive connection? [KEEPALIVE]",
                        arguments: {
                            KEEPALIVE: {
                                type: Scratch2.ArgumentType.BOOLEAN,
                                defaultValue: false,
                            },
                        },
                    },
                    {
                        opcode: "changeTurnOnlyMode",
                        blockType: Scratch2.BlockType.COMMAND,
                        text: "Use TURN only? [TURNONLY]",
                        arguments: {
                            TURNONLY: {
                                type: Scratch2.ArgumentType.BOOLEAN,
                                defaultValue: false,
                            },
                        },
                    },
                    {
                        opcode: "change_stun_url",
                        blockType: Scratch2.BlockType.COMMAND,
                        text: "Use [URL] for STUN",
                        arguments: {
                            URL: {
                                type: Scratch2.ArgumentType.STRING,
                                defaultValue: "stun://vpn.mikedev101.cc:5349",
                            },
                        },
                    },
                    {
                        opcode: "change_turn_url",
                        blockType: Scratch2.BlockType.COMMAND,
                        text: "Use [URL] for TURN with username [USER] password [PASS]",
                        arguments: {
                            URL: {
                                type: Scratch2.ArgumentType.STRING,
                                defaultValue: "turn://vpn.mikedev101.cc:5349",
                            },
                            USER: {
                                type: Scratch2.ArgumentType.STRING,
                                defaultValue: "free",
                            },
                            PASS: {
                                type: Scratch2.ArgumentType.STRING,
                                defaultValue: "free",
                            },
                        },
                    },

                    "---",

                    {
						blockType: Scratch2.BlockType.LABEL,
						text: '🔌 Connectivity'
					},

                    {
						opcode: "is_signalling_connected",
						blockType: Scratch2.BlockType.BOOLEAN,
						text: "Connected to server?",
					},

                    {
						opcode: "on_signalling_connect",
						blockType: Scratch2.BlockType.EVENT,
                        isEdgeActivated: false,
						text: "When connected",
					},
					{
						opcode: "on_signalling_disconnect",
						blockType: Scratch2.BlockType.EVENT,
                        isEdgeActivated: false,
						text: "When disconnected",
					},
					
                    {
						opcode: "initialize",
						blockType: Scratch2.BlockType.COMMAND,
						text: "Connect to server [SERVER]",
						arguments: {
							SERVER: {
								type: Scratch2.ArgumentType.STRING,
								defaultValue: "ws://localhost:3000/",
							},
						},
					},
                    {
                        opcode: "disconnect",
                        blockType: Scratch2.BlockType.COMMAND,
                        text: "Disconnect from server",
                    },

                    "---",

                    {
						blockType: Scratch2.BlockType.LABEL,
						text: '🙂 My Session'
					},

					{
						opcode: "my_ID",
						blockType: Scratch2.BlockType.REPORTER,
						text: "My Player ID",
					},
					{
						opcode: "my_Username",
						blockType: Scratch2.BlockType.REPORTER,
						text: "My Username",
					},
					{
						opcode: "get_client_mode",
						blockType: Scratch2.BlockType.REPORTER,
						text: "Am I a host or a peer?",
					},

                    {
						opcode: "is_signaling_auth_success",
						blockType: Scratch2.BlockType.BOOLEAN,
						text: "Username synced?",
					},

                    {
						opcode: "on_signalling_login",
						blockType: Scratch2.BlockType.EVENT,
                        isEdgeActivated: false,
						text: "When username synced",
					},

                    {
						opcode: "authenticate",
						blockType: Scratch2.BlockType.COMMAND,
						text: "Set username to [TOKEN]",
						arguments: {
							TOKEN: {
								type: Scratch2.ArgumentType.STRING,
								defaultValue: "Apple",
							},
						},
					},

                    /* {
                        blockType: Scratch2.BlockType.LABEL,
                        text: 'This is a label',
                    },
                    {
                        opcode: "dummy_reporter",
                        blockType: Scratch2.BlockType.REPORTER,
                        text: "This is a reporter",
                    },
                    {
                        opcode: "dummy_boolean",
                        blockType: Scratch2.BlockType.BOOLEAN,
                        text: "This is a boolean"
                    },
                    {
                        opcode: "dummy_command",
                        blockType: Scratch2.BlockType.COMMAND,
                        text: "This is a command",
                    },
                    {
                        opcode: "dummy_hat",
                        blockType: Scratch2.BlockType.HAT,
                        text: "This is a hat",
                    },
                    {
                        opcode: "dummy_event",
                        blockType: Scratch2.BlockType.EVENT,
                        text: "This is a event",
                    }, */
                ],
            }
        }

        isKeepaliveOn() {
            const self = this;
            return self.client.enableKeepalive;
        }

        isTurnOnlyModeOn() {
            const self = this;
            return self.client.turn_only;
        }

        changeKeepalive({ KEEPALIVE }) {
            const self = this;
            self.client.enableKeepalive = Scratch2.Cast.toBoolean(KEEPALIVE);
        }

        changeTurnOnlyMode({ TURNONLY }) {
            const self = this;
            self.client.turn_only = Scratch2.Cast.toBoolean(TURNONLY);
        }

        change_stun_url({ URL }) {
            const self = this;
            self.client.stun_url = URL;
        }

        change_turn_url({ URL, USER, PASS }) {
            const self = this;
            self.client.turn_url = URL;
            self.client.turn_username = USER;
            self.client.turn_password = PASS;
        }

        extension_version() {
            const self = this;
			return self.client.metadata.client_version;
		}

		api_version() {
            const self = this;
			return self.client.metadata.signaling_version;
		}

		protocol_version() {
            const self = this;
			return self.client.metadata.protocol_version;
		}

        is_signalling_connected() {
            const self = this;
            return ((self.client.socket != null) && self.client.socket.readyState == WebSocket.OPEN);
        }

        is_signaling_auth_success() {
            const self = this;
            return self.client.usernameSet;
        }

        initialize({ SERVER }) {
            const self = this;
            self.client.Connect(SERVER);
        }

        authenticate({ TOKEN }) {
            const self = this;
            self.client.SetUsername(TOKEN);
        }

        disconnect() {
            const self = this;
            self.client.Close();
        }

        my_ID() {
            const self = this;
            return (self.client.id != null) ? self.client.id : "";
        }

        my_Username() {
            const self = this;
            return (self.client.username != null) ? self.client.username : "";
        }

        get_client_mode() {
            const self = this;
            return ["", "host", "peer"][self.client.mode];
        }
    }

    // Register the extension
    Scratch2.extensions.register(new CloudLinkPhi(Scratch2.vm));
})(Scratch);