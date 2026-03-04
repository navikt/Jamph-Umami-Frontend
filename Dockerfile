# Build stage
FROM cgr.dev/chainguard/wolfi-base:latest AS builder

# Install Node.js and npm (Corepack provides pnpm)
RUN apk update && apk add --no-cache nodejs npm

# Enable pnpm via Corepack
RUN corepack enable && corepack prepare pnpm@9.12.2 --activate

# Build arg for GitHub token (provided by NAIS or CI/CD)
ARG GITHUB_TOKEN

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Create .npmrc for GitHub NPM registry authentication
RUN if [ -n "$GITHUB_TOKEN" ]; then \
    echo "//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}" > .npmrc && \
    echo "@navikt:registry=https://npm.pkg.github.com" >> .npmrc; \
    fi

# Install dependencies
RUN pnpm install --frozen-lockfile

# Remove .npmrc for security
RUN rm -f .npmrc

# Copy source code
COPY . .

# Build the application
RUN pnpm run build

# Production stage
FROM europe-north1-docker.pkg.dev/cgr-nav/pull-through/nav.no/node:25@sha256:5181bb4b6a9129064acae4632ea92f3f991dd30d63c5d804fe59b9ad70faa544

# Build arg for GitHub token
ARG GITHUB_TOKEN

WORKDIR /app

# Copy package files and npmrc
COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./

# Create .npmrc for GitHub NPM registry authentication
RUN if [ -n "$GITHUB_TOKEN" ]; then \
    echo "//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}" > .npmrc && \
    echo "@navikt:registry=https://npm.pkg.github.com" >> .npmrc; \
    fi

# Install production dependencies using pnpm
RUN pnpm install --prod --frozen-lockfile

# Remove .npmrc for security
RUN rm -f .npmrc

# Copy built assets and runtime files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.js ./
COPY --from=builder /app/.nais ./.nais

EXPOSE 8080

CMD ["server.js"]
