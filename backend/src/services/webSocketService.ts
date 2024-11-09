import WebSocket, { WebSocketServer } from "ws";
import redisService from "../services/redisService";
import { IUser } from "../interfaces/user.interface";
import { MessageTypeEnum } from "../enums/message-type.enum";

const activeConnections: Map<string, WebSocket> = new Map();

export const handleWebSocketConnection = (
  ws: WebSocket,
  wss: WebSocketServer
) => {
  ws.on("message", async (message: string) => {
    const data = JSON.parse(message);

    switch (data.type) {
      case MessageTypeEnum.JoinRoom:
        await handleJoinRoom(ws, data.roomId, data.userId, data.userName);
        break;
      case MessageTypeEnum.LeaveRoom:
        await handleLeaveRoom(data.roomId, data.userId);
        break;
      case MessageTypeEnum.Offer:
        await sendToUser(data.targetUserId, {
          type: "offer",
          offer: data.offer,
          userId: data.userId,
        });
        break;
      case MessageTypeEnum.Answer:
        await sendToUser(data.targetUserId, {
          type: "answer",
          answer: data.answer,
          userId: data.userId,
        });
        break;
      case MessageTypeEnum.IceCandidate:
        await sendToUser(data.targetUserId, {
          type: "ice-candidate",
          candidate: data.candidate,
          userId: data.userId,
        });
        break;
      case MessageTypeEnum.Disconnect:
        await handleDisconnect(data.userId);
        break;
    }
  });

  ws.on("close", async () => {
    const userId = [...activeConnections.entries()].find(
      ([_, socket]) => socket === ws
    )?.[0];
    if (userId) {
      await handleDisconnect(userId);
      activeConnections.delete(userId);
    }
  });
};

async function handleJoinRoom(
  ws: WebSocket,
  roomId: string,
  userId: string,
  userName: string
) {
  const user: IUser = { id: userId, name: userName };
  activeConnections.set(userId, ws);
  await redisService.setUserConnection(userId);
  await redisService.addUserToRoom(roomId, user);

  const usersInRoom = await redisService.getUsersInRoom(roomId);
  usersInRoom.forEach((otherUser) => {
    if (otherUser.id !== userId) {
      const otherUserSocket = activeConnections.get(otherUser.id);
      if (otherUserSocket) {
        otherUserSocket.send(
          JSON.stringify({
            type: MessageTypeEnum.UserJoined,
            userId,
            name: userName,
          })
        );
      }
      ws.send(
        JSON.stringify({
          type: MessageTypeEnum.UserJoined,
          userId: otherUser.id,
          name: otherUser.name,
        })
      );
    }
  });
}

async function handleLeaveRoom(roomId: string, userId: string) {
  await redisService.removeUserFromRoom(roomId, userId);
  await redisService.deleteUserConnection(userId);
  broadcastToRoom(roomId, { type: MessageTypeEnum.UserLeft, userId });
  const usersInRoom = await redisService.getUsersInRoom(roomId);
  if (usersInRoom.length === 0) {
    await redisService.deleteRoom(roomId);
  }
}

async function handleDisconnect(userId: string) {
  await redisService.setUserStatus(userId, "disconnected");
  await redisService.deleteUserConnection(userId);
}

async function sendToUser(targetUserId: string, message: object) {
  const targetSocket = activeConnections.get(targetUserId);
  if (targetSocket && targetSocket.readyState === WebSocket.OPEN) {
    targetSocket.send(JSON.stringify(message));
  }
}

async function broadcastToRoom(
  roomId: string,
  message: object,
  excludeUserId: string = ""
) {
  const users = await redisService.getUsersInRoom(roomId);
  for (const user of users) {
    if (user.id !== excludeUserId) {
      const userSocket = activeConnections.get(user.id);
      if (userSocket && userSocket.readyState === WebSocket.OPEN) {
        userSocket.send(JSON.stringify(message));
      }
    }
  }
}
