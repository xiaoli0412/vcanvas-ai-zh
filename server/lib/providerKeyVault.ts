import { createCipheriv, createHash, randomBytes } from 'node:crypto'
import type { ProviderChannel, ProviderEncryptedSecret, ProviderKeyCustody } from '../../shared/contracts/publicServer'

function keyMaterial() {
  const configured = process.env.VCANVAS_KEY_SECRET || process.env.VCANVAS_PROVIDER_KEY_SECRET || ''
  const source = configured || 'inscanvas-local-json-provider-key-v1'
  return {
    key: createHash('sha256').update(source).digest(),
    hint: configured ? 'env:VCANVAS_KEY_SECRET' : 'local-dev-fallback',
  }
}

export function maskSecret(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.length <= 8) return `${trimmed.slice(0, 2)}****`
  return `${trimmed.slice(0, 4)}****${trimmed.slice(-4)}`
}

export function encryptProviderApiKey(apiKey: string): ProviderEncryptedSecret | null {
  const trimmed = apiKey.trim()
  if (!trimmed) return null
  const { key, hint } = keyMaterial()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(trimmed, 'utf8'), cipher.final()])
  return {
    algorithm: 'aes-256-gcm',
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    keyHint: hint,
    createdAt: new Date().toISOString(),
  }
}

export function keyCustodyFor(channel: ProviderChannel): ProviderKeyCustody {
  if (channel.apiKeyEncrypted) {
    return {
      status: 'encrypted-local',
      encrypted: true,
      keyHint: channel.apiKeyEncrypted.keyHint,
      updatedAt: channel.apiKeyEncrypted.createdAt,
      note: channel.apiKeyEncrypted.keyHint === 'local-dev-fallback'
        ? 'Local AES-GCM fallback is active. Set VCANVAS_KEY_SECRET before production use.'
        : 'Provider key is encrypted before local-json persistence. This is not a production KMS/key-vault adapter yet.',
    }
  }
  if (channel.apiKeyMasked) {
    return {
      status: 'masked-only',
      encrypted: false,
      keyHint: null,
      updatedAt: null,
      note: 'Legacy masked-only key marker exists without encrypted custody.',
    }
  }
  return {
    status: 'none',
    encrypted: false,
    keyHint: null,
    updatedAt: null,
    note: null,
  }
}

export function stripProviderSecret(channel: ProviderChannel): ProviderChannel {
  const { apiKeyEncrypted: _apiKeyEncrypted, ...safe } = channel
  return {
    ...safe,
    apiKeyMasked: channel.apiKeyMasked || null,
    keyCustody: keyCustodyFor(channel),
  }
}
