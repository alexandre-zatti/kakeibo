# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
pnpm dev              # Start dev server with Turbopack
pnpm build            # Production build
pnpm start            # Start production server
pnpm lint             # Run ESLint
pnpm lint:fix         # Run ESLint with auto-fix

# Database (Prisma)
pnpm exec prisma generate    # Generate Prisma client
pnpm exec prisma db push     # Push schema to database (no migrations)
pnpm exec prisma migrate dev # Create and apply migrations
pnpm exec prisma studio      # Open Prisma Studio GUI
```

## Architecture

**Stack**: Next.js 15 (App Router, Turbopack, React Compiler), React 19, TypeScript, Tailwind CSS, PostgreSQL

**Authentication**: Better Auth with Prisma adapter (`src/lib/auth.ts` for server, `src/lib/auth-client.ts` for client). Auth API routes at `/api/auth/[...all]`.

**Database**: Prisma ORM with PostgreSQL. Schema at `prisma/schema.prisma`. Generated client uses `@prisma/client`. Singleton pattern in `src/lib/prisma.ts`.

**UI Components**: shadcn/ui (new-york style) with Lucide icons. Add components via `pnpm dlx shadcn@latest add <component>`. Components go in `src/components/ui/`.

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Auth route group (login, signup)
│   ├── (dashboard)/       # Protected route group
│   └── api/auth/          # Better Auth API handler
├── components/            # React components
│   └── ui/                # shadcn/ui components
├── lib/                   # Utilities (auth, prisma, logger, utils)
├── generated/prisma/      # Generated Prisma types (do not edit)
└── types/                 # TypeScript type definitions
```

## Environment Variables

Required in `.env` (see `.env.example`):

- `DATABASE_URL` - PostgreSQL connection string
- `BETTER_AUTH_SECRET` - Auth secret (generate with `openssl rand -base64 32`)
- `BETTER_AUTH_URL` - Server URL
- `NEXT_PUBLIC_BETTER_AUTH_URL` - Client URL

## Design Philosophy

**Mobile-First**: This application is designed primarily for mobile use. Always design and implement UI components with mobile as the primary target, then scale up for desktop browsers. Use responsive Tailwind classes starting from mobile breakpoints (`sm:`, `md:`, `lg:`).

## MCP Servers

**context7**: Use the context7 MCP server to look up documentation for any library or framework. Always use `resolve-library-id` first to get the correct library ID, then `query-docs` to fetch relevant documentation and code examples.

**shadcn**: Use the shadcn MCP server when working with UI components:

- `search_items_in_registries` - Find components by name/description
- `view_items_in_registries` - Get component details and file contents
- `get_item_examples_from_registries` - Get usage examples and demos
- `get_add_command_for_items` - Get the CLI command to add components

## Code Style

- ESLint extends `next/core-web-vitals` and `prettier`
- Prettier: double quotes, semicolons, 100 char width, Tailwind plugin for class sorting
- Path alias: `@/*` maps to `./src/*`

## Git Commits

- Do NOT add `Co-Authored-By` trailers to commit messages
- Write concise commit messages that explain the "why" rather than the "what"

## Development Loop

Before any change is considered ready, ALL of the following checks must pass with zero errors:

```bash
# 1. Format code with Prettier
pnpm exec prettier --write .

# 2. Run ESLint and fix issues
pnpm lint:fix

# 3. TypeScript type check (no emit)
pnpm exec tsc --noEmit
```

**Workflow**:

1. Make code changes
2. Run `pnpm exec prettier --write .` to format
3. Run `pnpm lint:fix` to fix linting issues
4. Run `pnpm exec tsc --noEmit` to verify types
5. Fix any errors that appear
6. Repeat steps 2-5 until all checks pass
7. Add any new files created during development to git VCS (`git add <files>`)
8. Only then is the change considered complete
