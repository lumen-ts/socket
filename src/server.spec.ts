import { describe, it, expect } from 'vitest';
import { SocketServer } from './server.js';

describe('SocketServer', () => {
  it('creates a server', () => {
    const server = new SocketServer({ port: 0 }); // random port
    expect(server).toBeDefined();
    server.close();
  });

  it('tracks connections', () => {
    const server = new SocketServer({ port: 0 });
    expect(server.connectionCount()).toBe(0);
    expect(server.getConnections()).toHaveLength(0);
    server.close();
  });

  it('creates and manages rooms', () => {
    const server = new SocketServer({ port: 0 });

    const room = server.room('test-room');
    expect(room).toBeDefined();
    expect(room.name).toBe('test-room');
    expect(room.size()).toBe(0);
    expect(room.isEmpty()).toBe(true);

    server.close();
  });

  it('registers event handlers', () => {
    const server = new SocketServer({ port: 0 });
    const calls: string[] = [];

    server.on('test', () => calls.push('handler1'));
    server.on('test', () => calls.push('handler2'));

    // Manually trigger (simulating what happens on connection)
    const handler = (server as any).handlers.get('test');
    expect(handler).toHaveLength(2);

    server.close();
  });
});
