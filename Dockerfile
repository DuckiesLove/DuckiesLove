FROM node:lts

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
