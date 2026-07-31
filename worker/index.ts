export interface Env {
  RESEND_API_KEY: string
}

export default {
  async fetch(request: Request, _env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/api/ping') {
      return Response.json({ ok: true })
    }

    return new Response(null, { status: 404 })
  },
} satisfies ExportedHandler<Env>
