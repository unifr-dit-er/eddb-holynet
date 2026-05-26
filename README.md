# EDDB Holynet

## Overview

EDDB Holynet is an interactive web mapping application built with React + Vite.

It lets you:
- display geographic points from a NocoDB API;
- filter results;
- view details in popups.

Main configuration is handled in `src/config.ts`.

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

### Build the image

```bash
podman build -t eddb-holynet .
```

### Run the container

```bash
podman run -d -p 3000:3000 --name eddb-holynet eddb-holynet
```

App: `http://localhost:3000`

The image builds the app at build time and serves the static files via `server.mjs` on port 3000.

### Update

```bash
git pull
podman build -t eddb-holynet .
podman stop eddb-holynet && podman rm eddb-holynet
podman run -d -p 3000:3000 --name eddb-holynet eddb-holynet
```
