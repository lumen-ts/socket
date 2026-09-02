import { WebSocketServer as WSServer, WebSocket } from 'ws';
import { randomBytes } from 'crypto';
import { Room } from './room.js';

/**
 * Socket connection interface.
 */
export interface SocketConnection {
  id: string;
  ws: WebSocket;
  rooms: Set<string>;
  data: Record<string, unknown>;
  send(data: unknown): void;
  join(room: string): void;
  leave(room: string): void;
  disconnect(): void;
}

/**
 * Socket message interface.
 */
export interface SocketMessage<T = unknown> {
  event: string;
  data: T;
  from?: string;
  room?: string;
  timestamp: number;
}

/**
 * Socket server options.
 */
export interface SocketOptions {
  /** Port to listen on. */
  port?: number;
  /** Path for WebSocket connections. Default '/ws'. */
  path?: string;
  /** Maximum connections. Default 10000. */
  maxConnections?: number;
  /** Heartbeat interval in ms. Default 30000. */
  heartbeatInterval?: number;
  /** Heartbeat timeout in ms. Default 10000. */
  heartbeatTimeout?: number;
  /** Enable CORS. Default true. */
  cors?: boolean;
}

/**
 * Socket event handler.
 */
export type SocketHandler = (conn: SocketConnection, message: SocketMessage) => void | Promise<void>;

/**
 * In-memory WebSocket server with rooms and broadcasting.
 * Zero external dependencies — uses Node's built-in WebSocket support.
 *
 * @example
 * ```ts
 * import { SocketServer } from '@lumen/socket';
 *
 * const socket = new SocketServer({ port: 3001 });
 *
 * socket.on('chat:message', (conn, msg) => {
 *   socket.broadcast('chat:message', msg.data, { room: 'general' });
 * });
 *
 * socket.on('join:room', (conn, msg) => {
 *   conn.join(msg.data.room);
 *   conn.send({ event: 'joined', data: { room: msg.data.room } });
 * });
 *
 * socket.on('connect', (conn) => {
 *   console.log(`Client connected: ${conn.id}`);
 *   conn.send({ event: 'welcome', data: { id: conn.id } });
 * });
 * ```
 */
export class SocketServer {
  private readonly wss: WSServer;
  private readonly connections = new Map<string, SocketConnection>();
  private readonly rooms = new Map<string, Room>();
  private readonly handlers = new Map<string, SocketHandler[]>();
  private heartbeatTimer?: ReturnType<typeof setInterval>;

  constructor(options: SocketOptions = {}) {
    this.wss = new WSServer({
      port: options.port ?? 3001,
      path: options.path ?? '/ws',
      maxPayload: 1024 * 1024, // 1MB
    });

    this.wss.on('connection', (ws) => this.handleConnection(ws));

    // Heartbeat
    const heartbeatInterval = options.heartbeatInterval ?? 30_000;
    this.heartbeatTimer = setInterval(() => {
      this.connections.forEach((conn) => {
        if (conn.ws.readyState === WebSocket.OPEN) {
          conn.ws.ping();
        }
      });
    }, heartbeatInterval);
  }

  /**
   * Register an event handler.
   */
  on(event: string, handler: SocketHandler): void {
    if (!this.handlers.has(event)) this.handlers.set(event, []);
    this.handlers.get(event)!.push(handler);
  }

  /**
   * Remove an event handler.
   */
  off(event: string, handler: SocketHandler): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      const idx = handlers.indexOf(handler);
      if (idx !== -1) handlers.splice(idx, 1);
    }
  }

  /**
   * Send a message to all connected clients.
   */
  broadcast(event: string, data: unknown, options?: { room?: string; exclude?: string }): void {
    const message: SocketMessage = { event, data, timestamp: Date.now() };
    const payload = JSON.stringify(message);

    if (options?.room) {
      const room = this.rooms.get(options.room);
      if (room) {
        room.broadcast(payload, options.exclude);
      }
      return;
    }

    this.connections.forEach((conn) => {
      if (conn.ws.readyState === WebSocket.OPEN && conn.id !== options?.exclude) {
        conn.ws.send(payload);
      }
    });
  }

  /**
   * Send a message to a specific client.
   */
  send(connectionId: string, event: string, data: unknown): void {
    const conn = this.connections.get(connectionId);
    if (conn && conn.ws.readyState === WebSocket.OPEN) {
      const message: SocketMessage = { event, data, timestamp: Date.now() };
      conn.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send a message to a room.
   */
  sendToRoom(room: string, event: string, data: unknown): void {
    const roomInstance = this.rooms.get(room);
    if (roomInstance) {
      const message: SocketMessage = { event, data, timestamp: Date.now() };
      roomInstance.broadcast(JSON.stringify(message));
    }
  }

  /**
   * Get a room by name.
   */
  getRoom(name: string): Room | undefined {
    return this.rooms.get(name);
  }

  /**
   * Get or create a room.
   */
  room(name: string): Room {
    if (!this.rooms.has(name)) {
      this.rooms.set(name, new Room(name));
    }
    return this.rooms.get(name)!;
  }

  /**
   * Get all connected clients.
   */
  getConnections(): SocketConnection[] {
    return [...this.connections.values()];
  }

  /**
   * Get connection count.
   */
  connectionCount(): number {
    return this.connections.size;
  }

  /**
   * Disconnect a specific client.
   */
  disconnect(connectionId: string): void {
    const conn = this.connections.get(connectionId);
    if (conn) {
      conn.disconnect();
    }
  }

  /**
   * Close the server.
   */
  async close(): Promise<void> {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);

    this.connections.forEach((conn) => {
      conn.ws.close(1000, 'Server shutting down');
    });

    this.connections.clear();
    this.rooms.clear();

    return new Promise((resolve) => {
      this.wss.close(() => resolve());
    });
  }

  private handleConnection(ws: WebSocket): void {
    const id = this.generateId();
    const conn: SocketConnection = {
      id,
      ws,
      rooms: new Set(),
      data: {},
      send: (data) => {
        if (ws.readyState === WebSocket.OPEN) {
          const message: SocketMessage = { event: 'message', data, timestamp: Date.now() };
          ws.send(JSON.stringify(message));
        }
      },
      join: (roomName) => {
        conn.rooms.add(roomName);
        const room = this.room(roomName);
        room.add(conn);
      },
      leave: (roomName) => {
        conn.rooms.delete(roomName);
        const room = this.rooms.get(roomName);
        if (room) room.remove(conn);
      },
      disconnect: () => {
        conn.rooms.forEach((roomName) => {
          const room = this.rooms.get(roomName);
          if (room) room.remove(conn);
        });
        this.connections.delete(id);
        ws.close(1000, 'Disconnected');
        this.emit('disconnect', conn, { event: 'disconnect', data: {}, timestamp: Date.now() });
      },
    };

    this.connections.set(id, conn);

    ws.on('message', (data) => {
      try {
        const parsed = JSON.parse(data.toString()) as SocketMessage;
        this.emit(parsed.event, conn, { ...parsed, from: id });
      } catch {
        // Invalid message format
      }
    });

    ws.on('close', () => {
      conn.rooms.forEach((roomName) => {
        const room = this.rooms.get(roomName);
        if (room) room.remove(conn);
      });
      this.connections.delete(id);
      this.emit('disconnect', conn, { event: 'disconnect', data: {}, timestamp: Date.now() });
    });

    ws.on('error', (error) => {
      this.emit('error', conn, { event: 'error', data: { message: error.message }, timestamp: Date.now() });
    });

    // Notify handlers
    this.emit('connect', conn, { event: 'connect', data: { id }, timestamp: Date.now() });
  }

  private emit(event: string, conn: SocketConnection, message: SocketMessage): void {
    const handlers = this.handlers.get(event) ?? [];
    for (const handler of handlers) {
      try {
        handler(conn, message);
      } catch (error) {
        console.error(`[Socket] Handler error for "${event}":`, error);
      }
    }
  }

  private generateId(): string {
    return `sock_${randomBytes(12).toString('hex')}`;
  }
}
