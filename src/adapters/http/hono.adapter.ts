import { Hono } from "hono";
import type { Context as HonoContext } from "hono";
import type {
  HttpServerPort,
  HttpHandler,
  HttpContext,
  HttpResponse,
} from "../../ports/http-server.port.js";

export class HonoAdapter implements HttpServerPort {
  private readonly app: Hono;

  constructor() {
    this.app = new Hono();
  }

  get(path: string, handler: HttpHandler): void {
    this.app.get(path, (c) => this.wrapHandler(c, handler));
  }

  post(path: string, handler: HttpHandler): void {
    this.app.post(path, (c) => this.wrapHandler(c, handler));
  }

  async listen(port: number): Promise<void> {
    Bun.serve({
      fetch: this.app.fetch,
      port,
    });
  }

  getNativeInstance(): Hono {
    return this.app;
  }

  private async wrapHandler(c: HonoContext, handler: HttpHandler) {
    let body: unknown = null;
    if (c.req.method === "POST" || c.req.method === "PUT" || c.req.method === "PATCH") {
      try {
        body = await c.req.json();
      } catch {
        body = null;
      }
    }

    const queryEntries = Object.fromEntries(
      new URL(c.req.url).searchParams.entries(),
    );

    const ctx: HttpContext = {
      body,
      query: queryEntries,
      params: c.req.param() as Record<string, string>,
      headers: Object.fromEntries(c.req.raw.headers.entries()),
    };

    const result = await handler(ctx);

    // Apply response headers (needed for redirects, CORS, etc.)
    if (result.headers) {
      for (const [key, value] of Object.entries(result.headers)) {
        c.header(key, value);
      }
    }

    if (result.body == null) {
      return c.body(null, result.status as any);
    }
    if (typeof result.body === "string") {
      return c.text(result.body, result.status as any);
    }
    return c.json(result.body, result.status as any);
  }
}
