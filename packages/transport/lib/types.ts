import type { AppOptions } from 'uWebSockets.js'

export type HttpTransportOptions = {
  port?: number
  hostname?: string
  unix?: string
  tls?: AppOptions
  maxPayloadLength?: number
  maxStreamChunkLength?: number
}

export type HttpConnectionData = {
  headers: Map<string, string>
  query: URLSearchParams
  remoteAddress: string
  proxiedRemoteAddress: string
}
