# ---- Build stage ----
FROM node:22-slim AS build
WORKDIR /usr/src/app

COPY package.json package-lock.json ./
RUN npm ci --silent
COPY . .
RUN npm run build


# ---- Runtime stage ----
FROM node:22-alpine3.19
ENV NODE_ENV=production
WORKDIR /usr/src/app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --silent
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/server.mjs ./server.mjs
EXPOSE 3000
USER node
CMD ["npm", "start"]
