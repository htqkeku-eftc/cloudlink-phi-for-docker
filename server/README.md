# Server
To run a Phi server, you will need a copy of [Go 1.23.1 or newer.](https://go.dev/dl)

Once you have Go, download a copy of this repository, extract it, and head to this directory.

Use `go mod tidy` to gather dependencies, and then `go run .` to start. You can also use `go build .` to compile the server.

# Default configuration
By default, this server will listen to all network interfaces on port 3000. 

It will also allow STUN connectivity, and permit any origin to connect.

To change these settings, view the comments in `main.go`.