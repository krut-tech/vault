// supabase/functions/run-code/index.ts
// Deploy: supabase functions deploy run-code

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const PISTON_URL = 'https://emkc.org/api/v2/piston/execute'

const LANGUAGE_MAP: Record<string, { language: string; version: string; ext: string }> = {
  javascript: { language: 'javascript', version: '18.15.0', ext: 'js' },
  typescript: { language: 'typescript', version: '5.0.3', ext: 'ts' },
  python: { language: 'python', version: '3.10.0', ext: 'py' },
  php: { language: 'php', version: '8.2.3', ext: 'php' },
  java: { language: 'java', version: '15.0.2', ext: 'java' },
  c: { language: 'c', version: '10.2.0', ext: 'c' },
  cpp: { language: 'cpp', version: '10.2.0', ext: 'cpp' },
  csharp: { language: 'csharp', version: '6.12.0', ext: 'cs' },
  go: { language: 'go', version: '1.16.2', ext: 'go' },
  rust: { language: 'rust', version: '1.68.2', ext: 'rs' },
  shell: { language: 'bash', version: '5.2.0', ext: 'sh' },
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401)

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: userData, error: userErr } = await supabaseClient.auth.getUser()
    if (userErr || !userData.user) return json({ error: 'Unauthorized' }, 401)

    const { language, code, stdin } = await req.json()
    if (typeof code !== 'string' || code.length === 0) return json({ error: 'No code provided' }, 400)
    if (code.length > 20000) return json({ error: 'Code exceeds the 20,000 character execution limit' }, 400)

    const mapped = LANGUAGE_MAP[language]
    if (!mapped) return json({ error: `Language "${language}" is not supported for execution` }, 400)

    const pistonRes = await fetch(PISTON_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: mapped.language,
        version: mapped.version,
        files: [{ name: `main.${mapped.ext}`, content: code }],
        stdin: typeof stdin === 'string' ? stdin : '',
        run_timeout: 8000,
        compile_timeout: 10000,
      }),
    })

    if (!pistonRes.ok) return json({ error: `Execution service error: ${await pistonRes.text()}` }, 502)

    const result = await pistonRes.json()
    return json({
      stdout: result.run?.stdout ?? '',
      stderr: result.run?.stderr ?? '',
      compileOutput: result.compile?.stderr ?? null,
      exitCode: result.run?.code ?? null,
    })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unknown execution error' }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
