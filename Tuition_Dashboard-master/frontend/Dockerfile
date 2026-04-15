# frontend/Dockerfile - dev-oriented (serves Vite dev server)
FROM node:20-alpine

WORKDIR /app

# copy package files first so npm ci can cache dependencies
COPY package*.json ./

# install dependencies (ci for deterministic install)
RUN npm ci

# copy rest of the app
COPY . .

# expose Vite dev server port
EXPOSE 5173

# start Vite dev server and bind to all interfaces (compose forwards the port)
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]