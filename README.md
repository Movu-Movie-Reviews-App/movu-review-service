# Review Service

Review and rating microservice for the Movu platform. Owns user reviews for movies/series and computes weekly top-rated rankings. Communicates exclusively over NATS — all client traffic reaches it through the [client-gateway](../client-gateway).

## Tech stack

- [NestJS](https://nestjs.com/) 11 (microservice mode)
- [NATS](https://nats.io/) transport (`@nestjs/microservices`)
- [TypeORM](https://typeorm.io/) + PostgreSQL (`pg`)
- `class-validator` / `class-transformer` for DTO validation
- `Joi` for environment variable validation

## Architecture

The service registers as a NATS microservice (no HTTP listener). On every review mutation (create/update/remove) it recalculates and publishes rating stats so the [content-service](../content-service) can keep its aggregate content ratings in sync, and consults content-service for content metadata as needed.

```
client-gateway --(NATS)--> review-service ── review-db (PostgreSQL)
                                 |
                                 └──(NATS event: content.ratingStatsChanged)──> content-service
```

## Message patterns

| Pattern | Description |
|---|---|
| `reviews.findByContent` | List reviews for a piece of content |
| `reviews.weeklyTopRated` | Weekly top-rated content ranking |
| `reviews.findOneByUserAndContent` | Get a user's review for a piece of content |
| `reviews.create` | Create a review (triggers a rating stats update) |
| `reviews.update` | Update a review (triggers a rating stats update) |
| `reviews.remove` | Delete a review (triggers a rating stats update) |

## Requirements

- Node.js 21+
- Docker & Docker Compose (recommended)
- A running PostgreSQL instance and NATS server (provided via Docker Compose)

## Environment variables

Configuration is validated in `src/config/envs.ts`. When run via the root `docker-compose.yml`, these are supplied automatically from the repo-level `.env` file.

| Variable | Description |
|---|---|
| `PORT` | Port the service reports as running on (informational; NATS transport has no HTTP port) |
| `DB_HOST` | PostgreSQL host |
| `REVIEW_DB_PORT` | PostgreSQL port |
| `DB_USERNAME` | PostgreSQL username |
| `DB_PASSWORD` | PostgreSQL password |
| `REVIEW_DB_NAME` | PostgreSQL database name |
| `NATS_SERVERS` | Comma-separated list of NATS server URLs |

## Running the service

### With Docker Compose (recommended)

From the repository root:

```bash
cp .env.template .env
# fill in the required values in .env
docker compose up review-service review-db nats-server
```

Or start the entire stack:

```bash
docker compose up
```

### Standalone (local development)

```bash
npm install
```

Create a `.env` file in this directory with the variables listed above, then:

```bash
npm run start:dev
```

## Scripts

| Command | Description |
|---|---|
| `npm run start` | Start the service |
| `npm run start:dev` | Start in watch mode |
| `npm run start:debug` | Start in watch mode with the debugger attached |
| `npm run start:prod` | Run the compiled build (`dist/main`) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run lint` | Lint and auto-fix source files |
| `npm run test` | Run unit tests |
| `npm run test:e2e` | Run end-to-end tests |
| `npm run test:cov` | Run tests with coverage report |

## Project structure

```
src/
├── review/
│   ├── review.controller.ts    # NATS message pattern handlers
│   ├── review.service.ts       # Business logic, rating stats calculation
│   ├── dto/                    # Request payload validation
│   ├── entities/                # TypeORM entity
│   └── enums/                     # Sort options
├── infrastructure/
│   └── messages/
│       └── content-client/         # NATS client module for calling content-service
├── config/                           # Environment variable validation
├── app.module.ts
└── main.ts
```
