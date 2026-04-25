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
npm run seed:population
npm run run:generation
npm run start:arena
```
