import { ApiError, type Format } from '@nmtjs/application'
import { ErrorCode } from '@nmtjs/common'
import type { HttpRequest } from 'uWebSockets.js'

export const getFormat = ({ headers, query }: RequestData, format: Format) => {
  const contentType = headers.get('content-type') || query.get('content-type')
  const acceptType = headers.get('accept') || query.get('accept')

  const encoder = contentType ? format.supportsEncoder(contentType) : undefined
  if (!encoder) throw new Error('Unsupported content-type')

  const decoder = acceptType ? format.supportsDecoder(acceptType) : undefined
  if (!decoder) throw new Error('Unsupported accept')

  return {
    encoder,
    decoder,
  }
}

export type RequestData = {
  url: string
  origin: URL | null
  method: string
  headers: Map<string, string>
  query: URLSearchParams
}

export const getRequestData = (req: HttpRequest): RequestData => {
  const url = req.getUrl()
  const method = req.getMethod()
  const headers = new Map()
  req.forEach((key, value) => headers.set(key, value))
  const query = new URLSearchParams(req.getQuery())
  const origin = headers.has('origin')
    ? new URL(url, headers.get('origin'))
    : null

  return {
    url,
    origin,
    method,
    headers,
    query,
  }
}

export const InternalError = (message = 'Internal Server Error') =>
  new ApiError(ErrorCode.InternalServerError, message)

export const NotFoundError = (message = 'Not Found') =>
  new ApiError(ErrorCode.NotFound, message)

export const ForbiddenError = (message = 'Forbidden') =>
  new ApiError(ErrorCode.Forbidden, message)

export const RequestTimeoutError = (message = 'Request Timeout') =>
  new ApiError(ErrorCode.RequestTimeout, message)
