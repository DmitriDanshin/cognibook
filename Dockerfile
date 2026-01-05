FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build Next.js
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Install Python 3 and uv for YouTube transcript functionality
RUN apk add --no-cache python3 py3-pip curl bash
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.cargo/bin:${PATH}"

# Pre-cache Python dependencies for faster YouTube operations
# This will download youtube-transcript-api and yt-dlp on build
RUN uv pip install --system youtube-transcript-api yt-dlp || true

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma files
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src/generated ./src/generated

# Create directories for uploads and db with correct permissions
RUN mkdir -p uploads/sources uploads/quizzes uploads/transcripts data
RUN chown -R nextjs:nodejs uploads data

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copy entrypoint script directly from context
COPY --chown=nextjs:nodejs scripts/docker-entrypoint.sh ./
USER root
RUN chmod +x docker-entrypoint.sh
USER nextjs

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
