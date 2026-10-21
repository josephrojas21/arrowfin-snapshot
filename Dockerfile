FROM node:22-bookworm-slim AS dependencies
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN npm ci
COPY packages/contracts packages/contracts

FROM dependencies AS api-build
COPY apps/api apps/api
RUN npm run db:generate && npm run build -w @arrowfin/api

FROM api-build AS api
ENV NODE_ENV=production
ENV ENABLE_DEV_TOOLS=false
USER node
EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]

FROM dependencies AS web-build
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
COPY apps/web apps/web
RUN test -n "$NEXT_PUBLIC_API_URL" && npm run build -w @arrowfin/web

FROM web-build AS web
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
USER node
EXPOSE 3000
WORKDIR /app/apps/web
CMD ["node", "../../node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0"]
