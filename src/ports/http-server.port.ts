export type HttpHandler = (ctx: HttpContext) => Promise<HttpResponse> | HttpResponse;

export interface HttpContext {
  body: unknown;
  query: Record<string, string>;
  params: Record<string, string>;
  headers: Record<string, string>;
}

export interface HttpResponse {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface HttpServerPort {
  get(path: string, handler: HttpHandler): void;
  post(path: string, handler: HttpHandler): void;
  listen(port: number): Promise<void>;
  getNativeInstance(): unknown;
}
