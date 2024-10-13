import { createTransport } from '@nmtjs/application'
import { HttpTransportServer } from './server.ts'
import type { HttpTransportOptions } from './types.ts'

export const HttpTransport = createTransport<HttpTransportOptions>(
  'HttpTransport',
  (app, options) => {
    return new HttpTransportServer(app, options)
  },
)
