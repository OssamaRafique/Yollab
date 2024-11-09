import cors from "cors";
import { config } from "dotenv";
import express from "express";
import http from "http";
import path from "path";
import WebSocket, { WebSocketServer } from "ws";

config({ path: path.resolve(__dirname, "./../.env") });

import yollabRoutes from "./routes/yollabRoutes";
import { handleWebSocketConnection } from "./services/webSocketService";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const PORT = process.env.PORT || 3000;

// Set up CORS to allow requests from any origin
app.use(cors({ origin: process.env.FRONTEND_URL }));

// Middleware for parsing JSON requests
app.use(express.json());

// Route handler
app.use("/api", yollabRoutes);

// WebSocket connection handler
wss.on("connection", (ws: WebSocket) => {
  handleWebSocketConnection(ws, wss);
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
