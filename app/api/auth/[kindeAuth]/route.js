export async function GET() {
	return new Response(
		JSON.stringify({ error: "Kinde auth removed. Use /auth instead." }),
		{ status: 410, headers: { "content-type": "application/json" } }
	)
}