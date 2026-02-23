# EDDB Simplemap

## Vue d’ensemble

EDDB Simplemap est une application web de cartographie interactive basée sur React + Vite.

Elle permet de :
- afficher des points géographiques issus d’une API NocoDB ;
- filtrer les résultats ;
- consulter les détails dans des popups ;
- déployer rapidement une instance en production.

La configuration principale se fait dans `src/config.ts`.

## Installation (et mise à jour)

### Prérequis

- Node.js 22 (recommandé)
- npm

### Première installation

```bash
npm install
npm run dev
```

Application de dev : `http://localhost:5173`

### Mise à jour d’une instance existante

```bash
git pull
npm install
```

Puis relancer selon le besoin :

```bash
# développement
npm run dev

# build de vérification
npm run build
```

## Mise en production

### Option 1 — Démarrage direct (Node)

```bash
npm install
npm run start
```

Le script `start` construit l’application puis lance `server.mjs` sur le port `3000`.

### Option 2 — Déploiement avec Docker

```bash
docker build -t eddb-simplemap .
docker run -p 3000:3000 eddb-simplemap
```

Application : `http://localhost:3000`
