# Cambrian

Base Darwin Protocol workspace scaffold for the off-chain runtime.

This pass intentionally excludes smart contracts and frontend work. The repo now focuses on:

- `apps/` for runnable services
- `core/` for Darwin domain logic
- `integrations/` for external boundaries
- `scripts/` for local operator workflows
- `config/` for environment and network setup

Useful commands:

```bash
npm run check
npm run start:backend
npm run seed:population
npm run run:generation
npm run start:arena
npm run spawn:axl-nodes -- 3 9002
```

AXL helper:

- `npm run spawn:axl-nodes -- 3 9002` prints a backend AXL node plus three agent nodes.
- Run one AXL node per agent when you need distinct `our_public_key` values.
- The backend AXL node is the bootstrap peer; agents join that mesh.

If an agent runs inside WSL while the backend runs on Windows, set `BACKEND_URL` explicitly or rely on the built-in host-gateway fallback in `apps/agent/loop.ts`.

Backend endpoints:

- `GET /api/health`
- `POST /api/arenas`
- `GET /api/arenas/:arenaId`
- `GET /api/arenas/:arenaId/state`
- `GET /api/arenas/:arenaId/agents`
- `GET /api/arenas/:arenaId/events` for SSE live updates
- `POST /api/arenas/:arenaId/rounds`
- `POST /api/arenas/:arenaId/run`
- `POST /api/tasks`
