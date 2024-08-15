import { Hook, createPlugin } from '@nmtjs/application'
import { HttpTransportServer } from './server.ts'
import type { HttpTransportOptions } from './types.ts'

export const HttpTransport = createPlugin<HttpTransportOptions>(
  'HttpTransport',
  (app, options) => {
    const server = new HttpTransportServer(app, options)
    app.hooks.add(Hook.OnStartup, async () => {
      await server.start()
    })
    app.hooks.add(Hook.OnShutdown, async () => {
      await server.stop()
    })
  },
)
