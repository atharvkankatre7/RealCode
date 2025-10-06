# Dependencies stage
FROM mcr.microsoft.com/cbl-mariner/base/nodejs:18 AS base
WORKDIR /app
ENV NODE_ENV=production

# Install dependencies with corepack to handle multiple lockfiles
RUN corepack enable

# Copy server package files
COPY server/package.json server/package-lock.json* ./

# Install only production deps
RUN npm ci --omit=dev || npm install --omit=dev

# Runtime stage
FROM mcr.microsoft.com/cbl-mariner/base/nodejs:18 AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Install runtime tools
RUN tdnf update -y && tdnf install -y curl && tdnf clean all

# Create non-root user
RUN groupadd -r nodegrp && useradd -r -g nodegrp nodeusr

# Copy node_modules and server source
COPY --from=base /app/node_modules ./node_modules
COPY server/ ./

# Expose port
EXPOSE 5002

# Healthcheck hits /health
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:5002/health || exit 1

# Default environment (override at runtime)
ENV PORT=5002
ENV ENABLE_TERMINAL=false

# Drop privileges
USER nodeusr

# Start server
CMD ["node", "index.js"]
