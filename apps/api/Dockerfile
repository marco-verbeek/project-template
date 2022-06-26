FROM node:16-alpine

WORKDIR "/api"

COPY . .

RUN npm i
RUN npm run build

CMD [ "node", "dist/main"]