FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/database/package*.json ./packages/database/
COPY packages/api/package*.json ./packages/api/
RUN npm install --legacy-peer-deps
COPY . .
RUN cd packages/shared && npx tsc
RUN cd packages/database && npx prisma generate && npx tsc
RUN cd packages/api && npx tsc
EXPOSE 4000
CMD ["node", "packages/api/dist/index.js"]
