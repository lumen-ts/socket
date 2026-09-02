# @lumen/socket

Servidor **WebSocket** em memória com **rooms** e broadcasting para Lumen.

```ts
import { SocketServer } from '@lumen/socket';
```

---

## SocketServer

```ts
const socket = new SocketServer({ port: 3001 });

socket.on('connect', (conn) => {
  console.log(`Cliente conectado: ${conn.id}`);
  conn.send({ event: 'welcome', data: { id: conn.id } });
});

socket.on('chat:message', (conn, msg) => {
  socket.broadcast('chat:message', msg.data, { room: 'general' });
});

socket.on('join:room', (conn, msg) => {
  conn.join(msg.data.room);
});
```

### `SocketOptions`

| Opção | Padrão | Descrição |
| --- | --- | --- |
| `port?` | `3001` | Porta de escuta. |
| `path?` | `/ws` | Caminho das conexões WebSocket. |
| `maxConnections?` | `10_000` | Máx. de conexões. |
| `heartbeatInterval?` | `30_000` | Intervalo de heartbeat (ping). |
| `heartbeatTimeout?` | `10_000` | Timeout do heartbeat. |
| `cors?` | `true` | Habilita CORS. |

### Métodos
- `on(event, handler)` / `off(event, handler)` — gerencia handlers.
- `broadcast(event, data, {room?, exclude?})` — envia a todos (ou a uma room).
- `send(connectionId, event, data)` — envia a um cliente.
- `sendToRoom(room, event, data)` — envia a uma room.
- `room(name)` / `getRoom(name)` — obtém/cria uma room.
- `getConnections()` / `connectionCount()` — clientes conectados.
- `disconnect(connectionId)` — desconecta um cliente.
- `close()` — encerra o servidor.

### Eventos embutidos
`connect`, `disconnect`, `error` (disparados nos handlers).

### `SocketConnection`
```ts
interface SocketConnection {
  id: string;
  ws: WebSocket;
  rooms: Set<string>;
  data: Record<string, unknown>;
  send(data): void;
  join(room): void;
  leave(room): void;
  disconnect(): void;
}
```

### `SocketMessage`
```ts
interface SocketMessage<T = unknown> {
  event: string;
  data: T;
  from?: string;
  room?: string;
  timestamp: number;
}
```

---

## Room

Gerencia um grupo de conexões com broadcast e envios direcionados.

```ts
import { Room } from '@lumen/socket';

const room = new Room('chat-general');
room.add(conn1);
room.add(conn2);

room.broadcast(JSON.stringify({ event: 'message', data: 'Hello!' }));
room.sendTo('Hello!', conn1.id);      // para um membro
room.sendToOthers('Oi', conn1.id);    // para todos menos um
```

Métodos: `add`, `remove`, `has`, `size`, `memberIds`, `getMembers`, `broadcast`, `sendTo`, `sendToOthers`, `isEmpty`, `info`.

`RoomOptions`: `maxMembers?` (padrão `Infinity`).

---

## Notas

- Usa `ws` para o transporte WebSocket (não depende do adaptador HTTP do Lumen).
- Limite de payload de **1MB**.
- Rooms e conexões são **em memória** (perdem-se ao reiniciar).
