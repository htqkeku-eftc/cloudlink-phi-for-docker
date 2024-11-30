package main

import (
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"

	srv "github.com/MikeDev101/cloudlink-phi/server/pkg/signaling"
	"github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"
)

func main() {
	s := srv.Initialize(
		[]string{"*"}, // Allowed origins. Use * for all origins.
		false,         // Enable TURN only mode. Candidates that specify STUN will be ignored, and only TURN candidates will be relayed.
	)

	// Initialize app
	app := fiber.New()

	// Configure routes
	app.Use("/", s.Upgrader)
	app.Get("/", websocket.New(s.Handler))

	// Initialize middleware
	app.Use(logger.New())
	app.Use(recover.New())

	// Start server
	app.Listen(":3000") // Listen on port 3000 by default. You can change this if needed.
}
