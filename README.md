![CloudLink Phi Banner](https://github.com/user-attachments/assets/f28b880c-baa0-450a-ab60-ee0a034dc679)

# CloudLink Φ ("Phi")

Imagine the simplicity of Classic CloudLink, but with the power of CloudLink Omega. Introducing CloudLink Phi, a "diet coke" client/server suite built using the CL5 protocol.

| Feature                                             | Phi (CLΦ) | Omega (CLΩ) | Classic (CL4 and older)        | 
|-----------------------------------------------------|-----------|-------------|--------------------------------|
| Uses the CL5 protocol on top of WebRTC              | ✅        | ✅         | ❌                             | 
| Hybrid connectivity (Server-client or peer-to-peer) | ✅        | ✅         | ❌                             |
| Voice calling support                               | ❌        | ✅         | ❌                             |
| Designed for Games                                  | ❌        | ✅         | ❔ possible but not recommended |
| For general-use connectivity                        | ✅        | ❌         | ✅                             |
| Mandatory authentication                            | ❌        | ✅         | ❌                             |

# Usage
## Technical requirements
Your browser needs to support the following features:
* [WebSockets](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API) - This is used to talk to a Phi server that can negotiate connections for you.
* [WebRTC](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API) - This is used to communicate with other players.
* [Web Locks](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API) - An internal dependency.
* [Web Crypto](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) - Used for end-to-end encryption of user data (Default lobby will not be CL5-level encrypted).

All modern browsers support these features out of the box. Unless you're using something old or obscure, it's probably best to update.

## Importing
Download a copy of `index.js` from this repository and import the extension into your Scratch editor of choice as "Unsandboxed".

## Getting connected
Simply use the Connect to server block to get started. Then, set a username so others can find you (This won't be used for data though).

![block_12_20_2024-10_23_02 PM](https://github.com/user-attachments/assets/546b35bb-69f8-4253-a30a-66c22481bbd1)

## Rooms
Like Classic CloudLink, you can create and join rooms. 

Rooms keep players and data separated, and keeps things tidy. Think of them like matches or lobbies in a game.

If you want to see what other rooms are available, you can retrieve the list using these blocks (It will output as a JSON array of strings).

![block_12_20_2024-10_27_44 PM](https://github.com/user-attachments/assets/c9d38fcb-aa22-46de-8c1f-ba2b9f8d0cf0)

To see details about a specific room, use these blocks (It will return a JSON object):

![block_12_20_2024-10_29_01 PM](https://github.com/user-attachments/assets/a9033b63-9aae-4659-b28c-3b1aa2588960)

You can use this block to make your own room at any time.

![block_12_20_2024-10_29_47 PM](https://github.com/user-attachments/assets/93c9fcbc-6673-429e-8ac8-0aa13a7c8a7a)

Setting the limit to zero will allow an unlimited number of players to join. **This can cause problems if you're not careful.**

There are several ownership modes available.

The default mode is "don't allow this room to be reclaimed", which does what it says on the tin: Once you leave, the room gets destroyed and everyone who joined will be forcibly disconnected.

"Allow the server to reclaim the room" will select the next available person to become the owner. This is the mode that the `default` room uses.

**"Allow peers to reclaim the room" is currently an experimental feature that should be left alone.**

On the other hand, if you want to join a room, use this block:

![block_12_20_2024-10_32_58 PM](https://github.com/user-attachments/assets/84450985-2145-4f18-87de-463a050bd559)

## Broadcasts

When the server relay is enabled in your room (which is the case for the `default` room), broadcasts will be sent using the `relay` player automatically. Instead of having to send a message to each player one-by-one yourself, the server can do it for you. Otherwise, the client does this for you at the cost of extra time and network consumption.

To send a broadcast, use this block:

![block_12_20_2024-10_35_11 PM](https://github.com/user-attachments/assets/4285cb8a-92a4-464b-8d63-dfd5528e94c5)

You can read the most recent broadcast received at any time using this block (Note that any broadcasts that *you* send won't be returned to you - only others will see it):

![block_12_20_2024-10_35_47 PM](https://github.com/user-attachments/assets/4021b95f-8436-49e6-8639-c10b19ee1809)

Additionally, if you want to know who was the one that last sent a broadcast, use this block:

![block_12_20_2024-10_36_36 PM](https://github.com/user-attachments/assets/fe73f4eb-df48-48a6-9837-02f316423c79)

If you want to process data when new messages come in, you can hook up code to this hat block (it works with clones):

![block_12_20_2024-10_37_41 PM](https://github.com/user-attachments/assets/b2ccf51d-d186-4e1d-87ba-e0979ad46b0f)

## Private data

To send some data directly to someone else, use this block:

![block_12_20_2024-10_38_16 PM](https://github.com/user-attachments/assets/0eb662d1-3008-428c-aefc-23ab61a45e40)

Reading back the received data is as simple as using this block:

![block_12_20_2024-10_38_45 PM](https://github.com/user-attachments/assets/5eff52b4-bbf5-40be-99ab-12152ef70c46)

Like the broadcast blocks, you can listen to incoming messages using this hat block (it also works with clones):

![block_12_20_2024-10_39_26 PM](https://github.com/user-attachments/assets/99208209-3be2-41d9-9ddc-ca6cbed2c741)

## Channels

Channels are a way to send vast amounts of different data using the same connection. Some might prefer being nice and tidy, others might prefer being extremely fast.

You can have as many as up to 65 thousand different channels per player ([browser-dependent](https://developer.mozilla.org/en-US/docs/Web/API/RTCDataChannel)). 

You can see if a player has a channel open:

![block_12_20_2024-10_43_16 PM](https://github.com/user-attachments/assets/1496c387-896f-41d9-a83d-a7e41fe426c6)

Or get a list of all their open channels (Returns a JSON array of strings):

![block_12_20_2024-10_43_33 PM](https://github.com/user-attachments/assets/a42f5c54-3ab6-49e9-9c18-fe0b8debb027)

Opening a new channel can be performed at any time and from any side. Use this block to begin:

![block_12_20_2024-10_43_45 PM](https://github.com/user-attachments/assets/0511504f-e702-4b33-9781-4af55876f2c5)

There are two modes:

"Reliability and order" and "Speed" do what exactly they say on the tin. One mode will try to keep messages in a timely and orderly fashion, while the other will prefer speed, knowing that some messages might get dropped.

Likewise, you can close a channel at any time and from any side using this block (note that you can't close the `default` channel; you can only close the connection with the player):

![block_12_20_2024-10_45_55 PM](https://github.com/user-attachments/assets/68120578-da2b-44f5-8996-9f4fbe4eaa68)

You can listen to new channels open/closing at any time using these hat blocks (even these work in clones):

![block_12_20_2024-10_46_19 PM](https://github.com/user-attachments/assets/acc86149-2fd1-4988-af33-53bf62d0d3a2)

![block_12_20_2024-10_46_23 PM](https://github.com/user-attachments/assets/999ecbce-cd54-4ec5-a436-c9396566c49e)
