export interface SSRContext {
  [key: string]: any
  teleports?: Record<string, string>
}

export declare function renderToString(
  input: unknown,
  context?: SSRContext,
): Promise<string>

export interface SimpleReadable {
  push(chunk: string | null): void
  destroy(err?: any): void
}

export declare function renderToSimpleStream<T extends SimpleReadable>(
  input: unknown,
  context: SSRContext | undefined,
  stream: T,
): T

export declare function renderToNodeStream(
  input: unknown,
  context?: SSRContext,
): { pipe(writable: any): any; on(...args: any[]): any; destroy(): void }

export declare function pipeToNodeWritable(
  input: unknown,
  context: SSRContext | undefined,
  writable: { end(): void; write?(chunk: any): any; destroy?(err?: any): void },
): void

export declare function renderToWebStream(
  input: unknown,
  context?: SSRContext,
): ReadableStream

export declare function pipeToWebWritable(
  input: unknown,
  context: SSRContext | undefined,
  writable: WritableStream,
): void

/** @deprecated */
export declare function renderToStream(
  input: unknown,
  context?: SSRContext,
): ReturnType<typeof renderToNodeStream>

export declare function ssrRenderVNode(...args: any[]): void
export declare function ssrRenderComponent(...args: any[]): null
export declare function ssrRenderSlot(...args: any[]): void
export declare function ssrRenderSlotInner(...args: any[]): void
export declare function ssrRenderTeleport(...args: any[]): void
export declare function ssrRenderSuspense(...args: any[]): void
export declare function ssrRenderList(...args: any[]): void
export declare function ssrRenderClass(...args: any[]): string
export declare function ssrRenderStyle(...args: any[]): string
export declare function ssrRenderAttrs(...args: any[]): string
export declare function ssrRenderAttr(...args: any[]): string
export declare function ssrRenderDynamicAttr(...args: any[]): string
export declare function ssrInterpolate(...args: any[]): string
export declare function ssrGetDirectiveProps(
  ...args: any[]
): Record<string, any>
export declare function ssrIncludeBooleanAttr(value: unknown): boolean
export declare function ssrLooseEqual(a: unknown, b: unknown): boolean
export declare function ssrLooseContain(list: unknown, value: unknown): boolean
export declare function ssrRenderDynamicModel(...args: any[]): string
export declare function ssrGetDynamicModelProps(...args: any[]): null
