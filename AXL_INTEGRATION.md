# AXL Integration - Peer-to-Peer Task Distribution

## Architecture

The Cambrian system now uses Gensyn's **AXL** (a peer-to-peer networking layer based on Yggdrasil) for agent-to-agent communication.

### AXL Node Architecture

- **HTTP API**: Port 9002 (localhost)
  - `GET /topology` - Get local peer ID and network state
  - `POST /send` - Send message to a peer (requires `X-Destination-Peer-Id` header)
  - `GET /recv` - Poll for inbound messages
  - `POST /mcp/{peer_id}/{service}` - JSON-RPC to remote MCP services
  - `POST /a2a/{peer_id}` - JSON-RPC to remote A2A services

### Message Flow

1. **Backend** -> sends task to agent via `POST /send`
2. **Agent** -> polls `GET /recv` in loop to receive tasks
3. **Agent** -> sends result via `POST /send` (needs backend's peer ID)

## Setup

### 1. Install and Start AXL Node

```bash
cd axl

# Build the node
make build

# Generate a private key (or use existing one)
openssl genpkey -algorithm ed25519 -out private.pem

# Create config (for local/development)
cat > node-config.json << 'EOF'
{
  "PrivateKeyPath": "private.pem",
  "api_port": 9002,
  "bridge_addr": "127.0.0.1"
}
EOF

# Run the node
./node -config node-config.json
```

The node will start on `http://localhost:9002`.

### 2. Configure Environment

In `.env`:
```env
AXL_NODE_URL=http://localhost:9002
```

### 3. Run Backend

```bash
npm run start:backend
```

The backend will start and be ready to send tasks.

### 4. Get Peer IDs

Before running agents, get the backend's peer ID:

```bash
curl http://localhost:9002/topology | jq .our_public_key
```

Set this in environment (or code) so agents know where to send results:

```env
BACKEND_PEER_ID=<64-char-hex-public-key>
```

### 5. Run Agent(s)

```bash
node dist/apps/agent/index.js <genome-id>
```

Agent will:
1. Get its own peer ID from AXL topology
2. Start polling `GET /recv` for incoming tasks
3. Wait for task from backend
4. Process task
5. Send result back to backend (via `POST /send`)

## Communication Pattern

### Send Task (Backend → Agent)

```bash
# Get agent's peer ID (from agent logs or configuration)
AGENT_PEER_ID="<64-char-hex>"

# Send task via POST /send
curl -X POST http://localhost:9002/send \
  -H "X-Destination-Peer-Id: $AGENT_PEER_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "task-123",
    "generation": 0,
    "round": 1,
    "topic": "darwin/task",
    "issuedAt": "2026-01-01T00:00:00Z",
    "context": {
      "poolAddress": "0x...",
      "roundWindowBlocks": 20
    }
  }'
```

### Receive Tasks (Agent)

Agent automatically polls `/recv` once per second (configurable):

```bash
curl http://localhost:9002/recv
```

Response (if message available):
```json
{
  "task": "data as sent by backend",
  "headers": {
    "X-From-Peer-Id": "backend-peer-id"
  }
}
```

### Send Result (Agent → Backend)

```bash
BACKEND_PEER_ID="<64-char-hex>"

curl -X POST http://localhost:9002/send \
  -H "X-Destination-Peer-Id: $BACKEND_PEER_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "result-456",
    "taskId": "task-123",
    "genomeId": "genesis-1",
    "action": {...},
    "fitness": 0.75
  }'
```

## Multi-Peer Network

To connect multiple AXL nodes (e.g., backend on machine A, agents on machine B):

### Machine A (Backend)

```json
{
  "PrivateKeyPath": "private.pem",
  "Listen": ["tls://0.0.0.0:9001"],
  "api_port": 9002,
  "bridge_addr": "0.0.0.0"
}
```

### Machine B (Agents)

```json
{
  "PrivateKeyPath": "private.pem",
  "Peers": ["tls://machine-a-ip:9001"],
  "api_port": 9002,
  "bridge_addr": "127.0.0.1"
}
```

## Troubleshooting

### Agent cannot receive tasks

1. Check AXL node is running: `curl http://localhost:9002/topology`
2. Check agent peer ID matches: `echo $BACKEND_PEER_ID`
3. Verify task sent to correct peer ID
4. Check agent logs for polling errors

### Tasks not reaching agent

1. Verify peer connectivity: `curl http://localhost:9002/topology` (check "peers" list)
2. Check task destination peer ID is correct (64-char hex from `our_public_key`)
3. Use curl to manually send task and verify agent receives it

### Cannot send result back to backend

1. Verify backend peer ID is set: `echo $BACKEND_PEER_ID`
2. Verify backend is still online and reachable
3. Check backend logs for errors

## Future Improvements

- [ ] Agent registry (backend tracks active agents)
- [ ] Task queue in backend (agents request tasks)
- [ ] MCP service registration for agent capabilities
- [ ] A2A (Agent-to-Agent) skill discovery
- [ ] Persistent task storage (KV or blockchain)
