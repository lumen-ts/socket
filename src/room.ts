import type { SocketConnection } from './server.js';

/**
 * Room options.
 */
export interface RoomOptions {
  /** Maximum members. Default Infinity. */
  maxMembers?: number;
}

/**
 * A room that manages a group of socket connections.
 * Supports broadcasting to all members, targeted sends, and member queries.
 *
 * @example
 * ```ts
 * const room = new Room('chat-general');
 * room.add(conn1);
 * room.add(conn2);
 *
 * room.broadcast(JSON.stringify({ event: 'message', data: 'Hello!' }));
 * room.sendTo('Hello!', conn1.id); // send to specific member
 * ```
 */
export class Room {
  readonly name: string;
  private readonly _members = new Map<string, SocketConnection>();
  private readonly maxMembers: number;

  constructor(name: string, options: RoomOptions = {}) {
    this.name = name;
    this.maxMembers = options.maxMembers ?? Infinity;
  }

  /**
   * Add a connection to the room.
   */
  add(conn: SocketConnection): boolean {
    if (this._members.size >= this.maxMembers) return false;
    this._members.set(conn.id, conn);
    return true;
  }

  /**
   * Remove a connection from the room.
   */
  remove(conn: SocketConnection): boolean {
    return this._members.delete(conn.id);
  }

  /**
   * Check if a connection is in the room.
   */
  has(conn: SocketConnection): boolean {
    return this._members.has(conn.id);
  }

  /**
   * Get the number of members in the room.
   */
  size(): number {
    return this._members.size;
  }

  /**
   * Get all member IDs.
   */
  memberIds(): string[] {
    return [...this._members.keys()];
  }

  /**
   * Get all member connections.
   */
  getMembers(): SocketConnection[] {
    return [...this._members.values()];
  }

  /**
   * Broadcast a message to all members.
   * @param excludeId - Connection ID to exclude from broadcast.
   */
  broadcast(data: string | Buffer, excludeId?: string): void {
    this._members.forEach((conn) => {
      if (conn.id !== excludeId && conn.ws.readyState === 1) {
        conn.ws.send(data);
      }
    });
  }

  /**
   * Send a message to a specific member.
   */
  sendTo(data: string | Buffer, connectionId: string): void {
    const conn = this._members.get(connectionId);
    if (conn && conn.ws.readyState === 1) {
      conn.ws.send(data);
    }
  }

  /**
   * Send a message to all members except one.
   */
  sendToOthers(data: string | Buffer, excludeId: string): void {
    this._members.forEach((conn) => {
      if (conn.id !== excludeId && conn.ws.readyState === 1) {
        conn.ws.send(data);
      }
    });
  }

  /**
   * Check if the room is empty.
   */
  isEmpty(): boolean {
    return this._members.size === 0;
  }

  /**
   * Get room info.
   */
  info(): { name: string; size: number; members: string[] } {
    return {
      name: this.name,
      size: this._members.size,
      members: this.memberIds(),
    };
  }
}
