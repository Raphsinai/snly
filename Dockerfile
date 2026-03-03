# Build stage
FROM node:22.12-alpine AS build
WORKDIR /app

# Install bun
RUN npm i -g bun@1

# Install deps
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile || bun install

# Copy source and build
COPY . .
RUN bun run build

# Runtime stage
FROM nginx:1.27-alpine

# Angular build output is typically dist/<project>/browser with @angular/build
COPY --from=build /app/dist/snly/browser /usr/share/nginx/html

# Basic SPA fallback
RUN printf '%s\n' \
'server {' \
'  listen 80;' \
'  server_name _;' \
'  root /usr/share/nginx/html;' \
'  include /etc/nginx/mime.types;' \
'  location = /vote {' \
'    return 204;' \
'  }' \
'  location / {' \
'    try_files $uri $uri/ /index.html;' \
'  }' \
'}' \
> /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
