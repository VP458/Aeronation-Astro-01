import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ locals }) => {
  const { DB } = locals.runtime.env;
  const { results } = await DB.prepare(
    "SELECT id, title, description, created_at FROM items ORDER BY created_at DESC LIMIT 100"
  ).all();
  return Response.json({ items: results });
};

export const POST: APIRoute = async ({ locals, request }) => {
  let body: { title?: unknown; description?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : null;

  if (!title) {
    return Response.json(
      { error: "'title' is required and must be a non-empty string" },
      { status: 400 }
    );
  }

  const { DB } = locals.runtime.env;
  const result = await DB.prepare(
    "INSERT INTO items (title, description) VALUES (?, ?) RETURNING id, title, description, created_at"
  )
    .bind(title, description)
    .first();

  return Response.json({ item: result }, { status: 201 });
};
