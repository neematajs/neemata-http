import {
  type LazyInjectable,
  type Scope,
  injectables,
} from '@nmtjs/application'
import type { HttpConnectionData } from './types.ts'

export const connectionData = injectables.connectionData as LazyInjectable<
  HttpConnectionData,
  Scope.Connection
>
