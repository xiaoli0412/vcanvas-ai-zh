import type { FastifyInstance } from 'fastify'

const siteSettings = {
  siteName: 'inscanvas Public Server',
  defaultModeId: 'custom',
  guestEnabled: true,
  serverExecutionDefault: false,
  publicGalleryEnabled: false,
  experimentalFeaturesEnabled: true,
}

const personalSettings = {
  displayName: 'Guest',
  avatarUrl: null,
  motto: 'Canvas first.',
  preferredModeId: 'custom',
}

export async function registerSettingsRoutes(app: FastifyInstance) {
  app.get('/api/settings/site', async () => ({
    ok: true,
    ...siteSettings,
  }))

  app.post('/api/settings/site', async (request) => ({
    ok: true,
    phase: 'phase-1-settings-placeholder',
    settings: {
      ...siteSettings,
      ...((request.body || {}) as Record<string, unknown>),
    },
    note: 'Site settings are mocked until persistence, permissions, and audit logs land.',
  }))

  app.get('/api/settings/personal', async () => ({
    ok: true,
    ...personalSettings,
  }))

  app.post('/api/settings/personal', async (request) => ({
    ok: true,
    phase: 'phase-1-settings-placeholder',
    settings: {
      ...personalSettings,
      ...((request.body || {}) as Record<string, unknown>),
    },
  }))
}
