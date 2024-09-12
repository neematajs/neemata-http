import {
  type AnyProcedure,
  ApiError,
  type ApplicationContext,
  type Connection,
  type Container,
  Scope,
  type Service,
  injectables,
} from '@nmtjs/application'
import { TransportType } from '@nmtjs/common'
import {
  App,
  type HttpRequest,
  type HttpResponse,
  SSLApp,
  type TemplatedApp,
} from 'uWebSockets.js'
import { connectionData } from './injectables.ts'
import type { HttpTransportOptions } from './types.ts'
import { InternalError, getFormat, getRequestData } from './utils.ts'

export class HttpTransportServer {
  protected server!: TemplatedApp
  protected readonly transportType = TransportType.HTTP

  constructor(
    protected readonly application: ApplicationContext,
    protected readonly options: HttpTransportOptions,
  ) {
    this.server = this.options.tls ? SSLApp(options.tls!) : App()

    this.server
      .options('/*', (res, req) => {
        this.applyCors(res, req)
        res.writeStatus('200 OK')
        res.endWithoutBody()
      })
      .get('/healthy', (res, req) => {
        this.applyCors(res, req)
        res.writeHeader('Content-Type', 'text/plain')
        res.end('OK')
      })
      .post('/api/:service/:procudure', async (res, req) => {
        const ac = new AbortController()
        res.onAborted(() => ac.abort())
        const tryEnd = (cb) => {
          if (!ac.signal.aborted)
            res.cork(() => {
              this.applyCors(res, req)
              return cb()
            })
        }

        try {
          const requestData = getRequestData(req)

          const serviceName = req.getParameter(0)!
          const procedureName = req.getParameter(1)!

          const service = this.application.registry.services.get(serviceName)

          if (!service) throw new Error(`Service ${serviceName} not found`)
          if (this.transportType in service.contract.transports === false)
            throw new Error(`Service ${serviceName} not supported`)

          const format = getFormat(requestData, this.application.format)
          const body = await this.getBody(res)
          const container = this.application.container.createScope(Scope.Call)
          const payload = body.byteLength ? format.decoder.decode(body) : null
          const connection = this.application.connections.add({
            services: [serviceName],
            type: this.transportType,
            subscriptions: new Map(),
          })

          const responseHeaders = new Headers()

          container.provide(connectionData, {
            query: requestData.query,
            headers: requestData.headers,
            proxiedRemoteAddress: Buffer.from(
              res.getProxiedRemoteAddressAsText(),
            ).toString(),
            remoteAddress: Buffer.from(res.getRemoteAddressAsText()).toString(),
            responseHeaders,
          })
          container.provide(injectables.connection, connection)

          const { procedure } = this.api.find(
            serviceName,
            procedureName,
            this.transportType,
          )

          try {
            const response = await this.handleRPC({
              connection,
              service,
              procedure,
              container,
              signal: ac.signal,
              payload,
            })

            tryEnd(() => {
              res
                .writeStatus('200 OK')
                .writeHeader('Content-Type', format.encoder.contentType)
              responseHeaders.forEach((v, k) => res.writeHeader(k, v))
              res.end(format.encoder.encode({ error: null, result: response }))
            })
          } catch (error: any) {
            if (error instanceof ApiError) {
              tryEnd(() =>
                res
                  .writeStatus('200 OK')
                  .end(format.encoder.encode({ error, result: null })),
              )
            } else {
              tryEnd(() =>
                res.writeStatus('200 OK').end(
                  format.encoder.encode({
                    error: InternalError(),
                    result: null,
                  }),
                ),
              )
            }
            this.logError(error)
          } finally {
            this.application.connections.remove(connection)
            this.handleContainerDisposal(container)
          }
        } catch (error: any) {
          this.logError(error)
          tryEnd(() =>
            res.writeStatus('500 Internal Server Error').endWithoutBody(),
          )
        }
      })
  }

  async start() {
    return new Promise<void>((resolve, reject) => {
      const hostname = this.options.hostname ?? '127.0.0.1'
      this.server.listen(hostname, this.options.port!, (socket) => {
        if (socket) {
          this.logger.info(
            'Server started on %s:%s',
            hostname,
            this.options.port!,
          )
          resolve()
        } else {
          reject(new Error('Failed to start server'))
        }
      })
    })
  }

  async stop() {
    this.server.close()
  }

  protected get api() {
    return this.application.api
  }

  protected get logger() {
    return this.application.logger
  }

  protected async logError(
    cause: Error,
    message = 'Unknown error while processing request',
  ) {
    this.logger.error(new Error(message, { cause }))
  }

  protected applyCors(res: HttpResponse, req: HttpRequest) {
    // TODO: this should be configurable
    const origin = req.getHeader('origin')
    if (!origin) return
    res.writeHeader('Access-Control-Allow-Origin', origin)
    res.writeHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.writeHeader('Access-Control-Allow-Methods', 'GET, POST')
    res.writeHeader('Access-Control-Allow-Credentials', 'true')
  }

  protected handleContainerDisposal(container: Container) {
    container.dispose()
  }

  protected async handleRPC(options: {
    connection: Connection
    service: Service
    procedure: AnyProcedure
    container: Container
    signal: AbortSignal
    payload: any
  }) {
    return await this.api.call({
      ...options,
      transport: this.transportType,
    })
  }

  protected async getBody(res: HttpResponse) {
    return new Promise<Buffer>((resolve) => {
      const chunks: Buffer[] = []
      res.onData((chunk, isLast) => {
        chunks.push(Buffer.from(chunk))
        if (isLast) {
          resolve(Buffer.concat(chunks))
        }
      })
    })
  }
}
