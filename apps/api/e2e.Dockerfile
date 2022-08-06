#######################
# BUILD FOR E2E TESTS #
#######################

FROM node:16-alpine As tests
WORKDIR /usr/src/app

COPY --chown=node:node package*.json ./
COPY --chown=node:node prisma ./prisma/

RUN npm install

COPY --chown=node:node . .

USER node
