---
name: ui
description: Conventions and best practices for UI development in this project, including component structure, styling, and page organization.
---
# UI Conventions

## Components

- shadcn/ui primitives in `@/components/ui/` — don't edit, use CLI to update
- Feature components in `@/components/[feature]/` (pool/, accounts/, uploads/)
- Pages are React Server Components by default
- `"use client"` goes on individual components, not pages

## Styling

- Tailwind CSS utility classes only. No CSS modules, no styled-components.
- Follow shadcn/ui theming patterns.
- Dark mode via `class` strategy.

## Pages

Keep pages thin — fetch data, compose components:

```typescript
// src/app/(dashboard)/pool/page.tsx
export default async function PoolPage() {
  const projects = await getProjects();
  return <ProjectList projects={projects} />;
}
```

## Forms

- Server Actions for all mutations (not API routes from client)
- `useActionState` for form state
- Zod on client (feedback) AND server (security)
- `useOptimistic` where appropriate

## Tables

- shadcn/ui `DataTable` pattern for paginated lists
- Server-side pagination (D1 `LIMIT`/`OFFSET`)
- URL search params for filters and pagination state

## API routes

```typescript
export async function GET() {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const data = await libFunction();
  return NextResponse.json(data);
}
```

Always: check auth first, validate bodies with Zod, return proper status codes, keep thin.
