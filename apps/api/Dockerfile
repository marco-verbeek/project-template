FROM node:16-alpine as development
WORKDIR "/api"

COPY package*.json ./
RUN npm install

COPY src/ tsconfig*.json ./

CMD [ "npm", "run", "start:debug" ]

# Unused for now: production build step
FROM node:16-alpine as production
WORKDIR "/api"

COPY --from=development /api/node_modules ./node_modules

RUN npm prune --production
RUN npm run build

CMD [ "node", "dist/main" ]
