# EDDB Holynet

## Overview

EDDB Holynet is an interactive web mapping application built with React + Vite.

It lets you:
- display geographic points from a NocoDB API;
- filter results;
- view details in popups.

Main configuration is handled in `src/config.ts`.

The code started as the Ludus map (https://eddb.unifr.ch/ludus/). The
version deployed for Ludus is tagged `ludus` (commit `e8de4ff`, 21.10.2025,
configuration `src/config.ludus.ts`); `main` has diverged since. To rebuild
Ludus, check out the tag and replace `node:22-alpine3.19` with
`node:22-alpine` in its Dockerfile.

## Development

### Prerequisites

- Node.js 22 (recommended)
- npm

### Setup

```bash
npm install
npm run dev
```

App: `http://localhost:5173`

### Update

```bash
git pull
npm install
```

## Production deployment with Podman

The image builds the app at build time and serves the static files via `server.mjs` on port 3000.

### Build the image

```bash
podman build -t eddb-holynet .
```

### Run as a systemd service (Quadlet)

A Quadlet unit file is provided in [deploy/eddb-holynet.container](deploy/eddb-holynet.container). It exposes the app on `127.0.0.1:8095`.

```bash
cp deploy/eddb-holynet.container ~/.config/containers/systemd/
systemctl --user daemon-reload
systemctl --user start eddb-holynet
```

### Update

```bash
git pull
podman build -t eddb-holynet .
systemctl --user restart eddb-holynet
```
