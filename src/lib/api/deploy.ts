import { supabase } from '../supabase'
import type { Database } from '../../types/database'

export type DeployTarget = Database['public']['Tables']['deploy_targets']['Row']
export type Deployment = Database['public']['Tables']['deployments']['Row']

export async function listDeployTargets(projectId: string) {
  const { data, error } = await supabase.from('deploy_targets').select('*').eq('project_id', projectId)
  if (error) throw error
  return data
}

export async function createDeployTarget(input: {
  project_id: string
  name: string
  protocol: 'ftp' | 'sftp'
  host: string
  port: number
  username: string
  password: string
  remote_path: string
  created_by: string
}) {
  const { data: secretData, error: secretErr } = await supabase.functions.invoke('save-deploy-secret', { body: { password: input.password } })
  if (secretErr) throw new Error(secretErr.message)
  if (!secretData?.secretRef) throw new Error(secretData?.error ?? 'Failed to store credential securely')

  const { data, error } = await supabase
    .from('deploy_targets')
    .insert({
      project_id: input.project_id,
      name: input.name,
      protocol: input.protocol,
      host: input.host,
      port: input.port,
      username: input.username,
      secret_ref: secretData.secretRef,
      remote_path: input.remote_path,
      created_by: input.created_by,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteDeployTarget(id: string) {
  const { error } = await supabase.from('deploy_targets').delete().eq('id', id)
  if (error) throw error
}

export async function triggerDeploy(targetId: string) {
  const { data, error } = await supabase.functions.invoke('deploy-project', { body: { targetId } })
  if (error) throw new Error(error.message)
  return data
}

export async function listDeployments(targetId: string) {
  const { data, error } = await supabase.from('deployments').select('*').eq('target_id', targetId).order('started_at', { ascending: false }).limit(20)
  if (error) throw error
  return data
}
