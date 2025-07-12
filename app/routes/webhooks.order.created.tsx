import { json } from "@remix-run/node";
import axios from "axios";

export const action = async ({ request }: any) => {
  const order: any = await request.json();

  // Forward the order to your third-party API (replace with your actual endpoint later)
  await axios.post(
    "https://webhook.site/8dc5a55f-f59c-4b5e-8344-150c74ef41c3",
    order,
    {
      headers: { "Content-Type": "application/json" },
    },
  );

  // Respond to Shopify (must be 200 OK)
  return json({ success: true });
};
