# ADR-001: Initial Architecture

## Status
Accepted

## Context
AskDSA needs semantic DSA search, grounded AI answers,
reliable ingestion, and a path to horizontal scaling.

## Decision
- Use a TypeScript monorepo.
- Use Next.js for the frontend.
- Use Express for the API.
- Use PostgreSQL, Drizzle ORM, and pgvector for persistence
  and retrieval.
- Use Redis for distributed rate limiting and caching.
- Run ingestion in a separate worker process.
- Use HTTP for API requests and SSE for streamed answers.
- Begin with a modular monolith; extract services only
  when measured needs justify doing so.

## Consequences
- One primary relational database initially.
- Clear boundaries between API, UI, and background jobs.
- Simpler local development and deployment.
- Independent scaling of API and worker processes later.
- Queue durability and worker concurrency must be designed
  explicitly before production ingestion.
