// Standard CORS headers for Able's public edge functions.
// Import and merge into your response headers:
//   return new Response(body, { headers: { ...corsHeaders, "Content-Type": "application/json" } });

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

// Short-circuit the preflight. Call this at the top of every function's fetch
// handler, before any body parsing or auth checks:
//   if (req.method === "OPTIONS") return handleCors();
export const handleCors = () =>
  new Response("ok", { headers: corsHeaders });
