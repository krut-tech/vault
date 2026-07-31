import { supabase } from '../supabase'

/**
 * Uses Supabase Auth's built-in TOTP MFA (auth.mfa.*) rather than a
 * hand-rolled client-side TOTP check. This matters: Supabase enforces MFA
 * at the session/token level (a second factor is genuinely required to
 * reach an "aal2" session), whereas a custom client-side code comparison
 * would only be cosmetic — anyone with the password could skip it.
 */

export async function listFactors() {
  const { data, error } = await supabase.auth.mfa.listFactors()
  if (error) throw error
  return data.totp // array of enrolled TOTP factors
}

export async function enrollTotp() {
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', issuer: 'CodeVault' })
  if (error) throw error
  // data.totp.qr_code is a data:image/svg+xml URI ready to render in an <img>
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret }
}

export async function verifyEnrollment(factorId: string, code: string) {
  const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId })
  if (challengeErr) throw challengeErr
  const { error: verifyErr } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code })
  if (verifyErr) throw verifyErr
}

export async function unenroll(factorId: string) {
  const { error } = await supabase.auth.mfa.unenroll({ factorId })
  if (error) throw error
}

export async function getAuthenticatorAssuranceLevel() {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (error) throw error
  return data // { currentLevel, nextLevel }
}
