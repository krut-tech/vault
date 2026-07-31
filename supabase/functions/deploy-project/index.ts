// supabase/functions/deploy-project/index.ts
//
// NOTE: basic-ftp and ssh2-sftp-client are Node libraries. Supabase Edge Functions
// (Deno) support npm: specifiers via a Node compatibility layer, but stream handling
// between Deno's web ReadableStream and Node's Readable can be version-sensitive.
// After deploying, run one test deployment against a real FTP/SFTP target and check
// `supabase functions logs deploy-project` — if uploads need a Node Readable instead
// of a web stream, swap `toStream()` for `Readable.from(Buffer.from(content))`
// (available via `import { Readable } from 'node:stream'`).

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { Client as FtpClient } from 'npm:basic-ftp@5.0.5'
import SftpClient from 'npm:ssh2-sftp-client@10.0.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Missing Authorization header' }, 401)

  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userData.user) return json({ error: 'Unauthorized' }, 401)

  const { targetId } = await req.json()
  if (!targetId) return json({ error: 'Missing targetId' }, 400)

  const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: target, error: targetErr } = await adminClient.from('deploy_targets').select('*').eq('id', targetId).single()
  if (targetErr || !target) return json({ error: 'Deploy target not found' }, 404)

  const { data: deployment, error: deployErr } = await adminClient.from('deployments').insert({ target_id: targetId, status: 'running' }).select().single()
  if (deployErr) return json({ error: deployErr.message }, 500)

  try {
    const { data: password } = await adminClient.rpc('vault_read_secret', { secret_id: target.secret_ref })
    if (!password) throw new Error('Could not decrypt stored credential')

    const [{ data: folders }, { data: files }] = await Promise.all([
      adminClient.from('folders').select('*').eq('project_id', target.project_id).eq('is_deleted', false),
      adminClient.from('files').select('*').eq('project_id', target.project_id).eq('is_deleted', false),
    ])

    const folderPath = (folderId: string | null, foldersList: typeof folders): string => {
      if (!folderId || !foldersList) return ''
      const folder = foldersList.find((f) => f.id === folderId)
      if (!folder) return ''
      const parent = folderPath(folder.parent_id, foldersList)
      return parent ? `${parent}/${folder.name}` : folder.name
    }

    const uploadPlan = (files ?? []).map((f) => ({
      remotePath: `${target.remote_path.replace(/\/$/, '')}/${folderPath(f.folder_id, folders)}/${f.name}`.replace(/\/{2,}/g, '/'),
      content: f.content,
    }))

    let log = `Deploying ${uploadPlan.length} file(s) to ${target.host} via ${target.protocol.toUpperCase()}\n`

    if (target.protocol === 'ftp') {
      const client = new FtpClient()
      await client.access({ host: target.host, port: target.port, user: target.username, password, secure: false })
      for (const item of uploadPlan) {
        await client.ensureDir(dirname(item.remotePath))
        await client.uploadFrom(toStream(item.content), basename(item.remotePath))
        log += `  ✓ ${item.remotePath}\n`
      }
      client.close()
    } else {
      const sftp = new SftpClient()
      await sftp.connect({ host: target.host, port: target.port, username: target.username, password })
      for (const item of uploadPlan) {
        const dir = dirname(item.remotePath)
        const exists = await sftp.exists(dir)
        if (!exists) await sftp.mkdir(dir, true)
        await sftp.put(Buffer.from(item.content, 'utf-8'), item.remotePath)
        log += `  ✓ ${item.remotePath}\n`
      }
      await sftp.end()
    }

    await adminClient.from('deployments').update({ status: 'success', log, finished_at: new Date().toISOString() }).eq('id', deployment.id)
    return json({ success: true, deploymentId: deployment.id, log })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown deployment error'
    await adminClient.from('deployments').update({ status: 'failed', log: message, finished_at: new Date().toISOString() }).eq('id', deployment.id)
    return json({ success: false, error: message, deploymentId: deployment.id }, 500)
  }
})

function dirname(path: string) {
  const parts = path.split('/')
  parts.pop()
  return parts.join('/') || '/'
}

function basename(path: string) {
  return path.split('/').pop() ?? path
}

function toStream(content: string) {
  const encoder = new TextEncoder()
  const bytes = encoder.encode(content)
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  })
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
