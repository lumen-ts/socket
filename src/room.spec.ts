import { describe, it, expect } from 'vitest';
import { Room } from './room.js';

describe('Room', () => {
  it('creates a room with a name', () => {
    const room = new Room('test-room');
    expect(room.name).toBe('test-room');
    expect(room.size()).toBe(0);
    expect(room.isEmpty()).toBe(true);
  });

  it('adds and removes members', () => {
    const room = new Room('test-room');
    const mockConn = { id: 'conn-1', ws: { readyState: 1 } } as any;

    room.add(mockConn);
    expect(room.size()).toBe(1);
    expect(room.has(mockConn)).toBe(true);
    expect(room.isEmpty()).toBe(false);

    room.remove(mockConn);
    expect(room.size()).toBe(0);
    expect(room.has(mockConn)).toBe(false);
    expect(room.isEmpty()).toBe(true);
  });

  it('respects max members', () => {
    const room = new Room('test-room', { maxMembers: 2 });

    const conn1 = { id: 'c1' } as any;
    const conn2 = { id: 'c2' } as any;
    const conn3 = { id: 'c3' } as any;

    expect(room.add(conn1)).toBe(true);
    expect(room.add(conn2)).toBe(true);
    expect(room.add(conn3)).toBe(false); // max reached
    expect(room.size()).toBe(2);
  });

  it('returns member IDs', () => {
    const room = new Room('test');
    const conn1 = { id: 'c1' } as any;
    const conn2 = { id: 'c2' } as any;

    room.add(conn1);
    room.add(conn2);

    expect(room.memberIds()).toEqual(['c1', 'c2']);
  });

  it('returns room info', () => {
    const room = new Room('test');
    const conn = { id: 'c1' } as any;
    room.add(conn);

    const info = room.info();
    expect(info.name).toBe('test');
    expect(info.size).toBe(1);
    expect(info.members).toEqual(['c1']);
  });

  it('broadcasts to all members', () => {
    const room = new Room('test');
    const messages: string[] = [];
    const conn1 = {
      id: 'c1',
      ws: { readyState: 1, send: (data: string) => messages.push(data) },
    } as any;
    const conn2 = {
      id: 'c2',
      ws: { readyState: 1, send: (data: string) => messages.push(data) },
    } as any;

    room.add(conn1);
    room.add(conn2);
    room.broadcast('hello');

    expect(messages).toEqual(['hello', 'hello']);
  });

  it('broadcasts exclude a connection', () => {
    const room = new Room('test');
    const messages: string[] = [];
    const conn1 = {
      id: 'c1',
      ws: { readyState: 1, send: (data: string) => messages.push(data) },
    } as any;
    const conn2 = {
      id: 'c2',
      ws: { readyState: 1, send: (data: string) => messages.push(data) },
    } as any;

    room.add(conn1);
    room.add(conn2);
    room.broadcast('hello', 'c1');

    expect(messages).toEqual(['hello']);
  });
});
