import { providers } from '@nmtjs/application'
import type { HttpConnectionData } from './types.ts'

export const connectionData =
  providers.connectionData.$withType<HttpConnectionData>()
