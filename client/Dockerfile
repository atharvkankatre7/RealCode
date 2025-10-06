# Next.js production image
FROM mcr.microsoft.com/cbl-mariner/base/nodejs:18 AS deps
WORKDIR /app
# Install all deps for building
RUN corepack enable
COPY client/package.json client/yarn.lock client/package-lock.json* ./
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  else npm install; fi

FROM mcr.microsoft.com/cbl-mariner/base/nodejs:18 AS builder
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY client/ ./
# Build Next.js
RUN npm run build || yarn build

FROM mcr.microsoft.com/cbl-mariner/base/nodejs:18 AS runner
WORKDIR /app
ENV NODE_ENV=production
# Create non-root user
RUN addgroup -S nodegrp && adduser -S nodeusr -G nodegrp

# Copy build output and runtime files
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

# Prune devDependencies to slim the image
RUN npm prune --omit=dev || true

ENV PORT=3000
EXPOSE 3000

# Healthcheck simple GET on /
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ || exit 1

USER nodeusr
CMD ["npm", "run", "start"]
