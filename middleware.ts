import { next } from '@vercel/edge'

// Runs on Vercel's edge network before any request reaches the built SPA.
// Checks the visitor's IP against `ip_allowlist` in Supabase. If that table
// is empty, no restriction applies — this is opt-in: an admin turns it on
// by adding at least one entry from the Admin panel. Vercel auto-detects a
// root-level `middleware.ts` regardless of framework, so this works for a
// plain Vite/SPA deployment without needing Next.js.

export const config = {
  matcher: '/((?!_next/static|assets|favicon|icons|media|manifest).*)',
}

let cache: { ips: Set<string>; expiresAt: number } | null = null

async function getAllowlist(): Promise<Set<string>> {
  if (cache && cache.expiresAt > Date.now()) return cache.ips

  const url = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anonKey) return new Set()

  try {
    const res = await fetch(`${url}/rest/v1/ip_allowlist?select=ip`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    })
    if (!res.ok) return new Set()
    const rows = (await res.json()) as { ip: string }[]
    const ips = new Set(rows.map((r) => r.ip))
    cache = { ips, expiresAt: Date.now() + 60_000 } // 1 min cache so we don't hit Supabase on every request
    return ips
  } catch {
    return new Set() // fail open on a network blip rather than lock everyone out
  }
}

export default async function middleware(request: Request) {
  const allowlist = await getAllowlist()
  if (allowlist.size === 0) return next() // feature is off until an admin adds an entry

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip') ?? ''
  if (allowlist.has(ip)) return next()

  return new Response('Access restricted: your IP is not on the allowlist.', { status: 403 })
}
