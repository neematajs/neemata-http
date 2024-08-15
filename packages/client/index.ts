import {
  ClientTransport,
  type ClientTransportRpcCall,
  type ClientTransportRpcResult,
} from '@nmtjs/client'
import { ErrorCode, TransportType } from '@nmtjs/common'

export type ClientOptions = {
  /**
   * The origin of the server
   * @example 'http://localhost:3000'
   */
  origin: string
  debug?: boolean
}

export type HttpRpcOptions = {
  timeout?: number
  headers?: Record<string, string>
  signal?: AbortSignal
}

export class HttpClient extends ClientTransport {
  type = TransportType.HTTP
  private attempts = 0

  constructor(private readonly options: ClientOptions) {
    super()
  }

  async healthCheck() {
    while (true) {
      try {
        const signal = AbortSignal.timeout(10000)
        const url = this.getURL('healthy')
        const { ok } = await fetch(url, { signal })
        if (ok) break
      } catch (e) {}
      this.attempts++
      const seconds = Math.min(this.attempts, 15)
      await new Promise((r) => setTimeout(r, seconds * 1000))
    }
  }

  async connect() {}
  async disconnect() {}

  async rpc(params: ClientTransportRpcCall): Promise<ClientTransportRpcResult> {
    const { service, procedure, payload, signal } = params
    const url = this.getURL(`api/${service}/${procedure}`)
    const body = this.client.format.encode(payload)

    const response = await fetch(url, {
      method: 'POST',
      body,
      signal,
      keepalive: true,
      credentials: 'include',
      cache: 'no-cache',
      headers: {
        'Content-Type': this.client.format.contentType,
        Accept: this.client.format.contentType,
        ...(this.client.auth ? { Authorization: this.client.auth } : {}),
      },
    })

    if (!response.ok) {
      return {
        success: false,
        error: {
          code: ErrorCode.InternalServerError,
          data: { status: response.status, statusText: response.statusText },
          message: await response.text(),
        },
      }
    } else {
      const buf = await response.arrayBuffer()
      const { error, response: rpcResponse } = this.client.format.decode(buf)
      if (error) {
        return { success: false, error }
      } else {
        return { success: true, value: rpcResponse }
      }
    }
  }

  private getURL(path = '', params = '') {
    const url = new URL(path, this.options.origin)
    url.search = params
    return url
  }
}
