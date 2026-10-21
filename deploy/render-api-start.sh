#!/bin/sh
set -eu
# Render supplies this secret file; no secret values are committed or printed.
node --env-file-if-exists=/etc/secrets/api.env node_modules/prisma/build/index.js migrate deploy --schema apps/api/prisma/schema.prisma
exec node --env-file-if-exists=/etc/secrets/api.env apps/api/dist/main.js
