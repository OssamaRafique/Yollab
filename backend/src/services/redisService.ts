import { createClient } from "redis";
import { IUser, IUserWithRoom } from "../interfaces/user.interface";

class RedisService {
  private client;

  constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL,
    });
    this.client
      .connect()
      .catch((err) => console.error("Redis connection error:", err));
  }

  // Room and User Management
  async addUserToRoom(roomId: string, user: IUser) {
    // Add user ID to the room's user set
    await this.client.sAdd(`room:${roomId}`, user.id);
    // Store user details as a hash
    await this.client.hSet(`user:${user.id}`, {
      id: user.id,
      name: user.name,
      roomId: roomId,
    });
  }

  async removeUserFromRoom(roomId: string, userId: string) {
    // Remove user ID from the room set
    await this.client.sRem(`room:${roomId}`, userId);
    // Remove user details
    await this.client.del(`user:${userId}`);
  }

  async getUsersInRoom(roomId: string): Promise<IUser[]> {
    // Get all user IDs in the room
    const userIds = await this.client.sMembers(`room:${roomId}`);
    // Fetch each user's details
    const users = await Promise.all(
      userIds.map((userId) => this.getUser(userId))
    );
    return users.filter((user): user is IUserWithRoom => user !== null); // Filter out null results
  }

  async deleteRoom(roomId: string) {
    // Delete the room's set of users
    await this.client.del(`room:${roomId}`);
  }

  // User Details Management
  async getUser(userId: string): Promise<IUserWithRoom | null> {
    const data = await this.client.hGetAll(`user:${userId}`);
    if (Object.keys(data).length === 0) return null; // No user found
    return { id: data.id, name: data.name, roomId: data.roomId };
  }

  // Connection and Status Management
  async setUserConnection(userId: string) {
    await this.client.set(`user:${userId}:connected`, "true");
  }

  async isUserConnected(userId: string): Promise<boolean> {
    return (await this.client.get(`user:${userId}:connected`)) === "true";
  }

  async deleteUserConnection(userId: string) {
    await this.client.del(`user:${userId}:connected`);
  }

  async setUserStatus(userId: string, status: string) {
    await this.client.set(`user:${userId}:status`, status);
  }

  async getUserStatus(userId: string): Promise<string | null> {
    return this.client.get(`user:${userId}:status`);
  }

  async deleteUserStatus(userId: string) {
    await this.client.del(`user:${userId}:status`);
  }
}

export default new RedisService();
