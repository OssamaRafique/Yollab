import WebSocket from "ws";

export interface IUser {
  id: string;
  name: string;
}

export interface IUserWithRoom extends IUser {
  roomId: string;
}
