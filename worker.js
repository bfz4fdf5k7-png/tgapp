const ALLOWED_ORIGIN = "https://bfz4fdf5k7-png.github.io";
const BYBIT = "https://api2.bybit.com/fiat/otc/item/online";

export default {
  async fetch(request) {
    const cors = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }
    if (request.method !== "POST") {
      return new Response("ok", { headers: cors });
    }
    const body = await request.text();
    const upstream = await fetch(BYBIT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
        "Origin": "https://www.bybit.com",
        "Referer": "https://www.bybit.com/",
      },
      body: body,
    });
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  },
};
