export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message?: string
  ) {
    super(message ?? code);
    this.name = "ApiError";
  }

  toResponse() {
    return Response.json(
      { error: this.code, message: this.message },
      { status: this.status }
    );
  }
}

export function apiHandler<Context = unknown>(
  handler: (request: Request, context: Context) => Promise<Response>
) {
  return async (request: Request, context: Context): Promise<Response> => {
    try {
      return await handler(request, context);
    } catch (error) {
      if (error instanceof ApiError) return error.toResponse();
      console.error("[NEXUS] erro na API:", error);
      return Response.json(
        { error: "internal_error", message: "Erro interno no servidor." },
        { status: 500 }
      );
    }
  };
}

export async function readJson(request: Request) {
  try {
    const text = await request.text();
    if (!text.trim()) return { ok: false as const, data: null };
    return { ok: true as const, data: JSON.parse(text) as unknown };
  } catch {
    return { ok: false as const, data: null };
  }
}

export function badRequest(message = "Payload invalido.") {
  return Response.json({ error: "bad_request", message }, { status: 400 });
}
