import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  from: z.string().min(3).max(3),
  to: z.string().min(3).max(3),
});

// Fetches the latest spot rate from Google Finance (public quote page).
// Returns rate = 1 unit of `from` in `to`.
export const getSpotRate = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const from = data.from.toUpperCase();
    const to = data.to.toUpperCase();
    if (from === to) return { rate: 1, from, to, source: "identity" as const };

    const url = `https://www.google.com/finance/quote/${from}-${to}`;
    const res = await fetch(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
        "accept-language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) throw new Error(`Google Finance responded ${res.status}`);
    const html = await res.text();

    // Google Finance renders the price in a <div data-last-price="1.2731" ...>
    let rate: number | null = null;
    const m1 = html.match(/data-last-price="([\d.]+)"/);
    if (m1) rate = Number(m1[1]);
    if (rate === null || !Number.isFinite(rate)) {
      // Fallback: look for the AF_initDataCallback payload with the numeric price.
      const m2 = html.match(/"currency":"[A-Z]{3}","([\d.]+)"/);
      if (m2) rate = Number(m2[1]);
    }
    if (rate === null || !Number.isFinite(rate) || rate <= 0) {
      throw new Error(`Could not parse spot rate for ${from}/${to}`);
    }
    return { rate, from, to, source: "google-finance" as const, as_of: new Date().toISOString() };
  });