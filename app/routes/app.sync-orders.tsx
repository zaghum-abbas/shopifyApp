import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import axios from "axios";

export const loader = async ({ request }: any) => {
  let admin;
  try {
    const auth = await authenticate.admin(request);
    admin = auth.admin;
  } catch (err: any) {
    const url = new URL(request.url);
    const baseUrl = new URL(request.url).origin;
    throw Response.redirect(
      `${baseUrl}/auth/login?returnTo=${encodeURIComponent(url.pathname + url.search)}`,
      302,
    );
  }

  let hasNextPage = true;
  let after = null;
  let allOrders: any = [];

  while (hasNextPage) {
    const response: any = await admin.graphql(
      `#graphql
      query getOrders($first: Int!, $after: String) {
        orders(first: $first, after: $after) {
          edges {
            node {
              id
              name
              createdAt
              # add other fields you need
            }
            cursor
          }
          pageInfo {
            hasNextPage
          }
        }
      }`,
      {
        variables: {
          first: 50,
          after,
        },
      },
    );
    const data = await response.json();
    const orders = data.data.orders.edges.map((edge: any) => edge.node);
    allOrders = allOrders.concat(orders);

    hasNextPage = data.data.orders.pageInfo.hasNextPage;
    after = hasNextPage
      ? data.data.orders.edges[data.data.orders.edges.length - 1].cursor
      : null;
  }

  await axios
    .post(
      "https://webhook.site/8dc5a55f-f59c-4b5e-8344-150c74ef41c3",
      allOrders,
      { headers: { "Content-Type": "application/json" } },
    )
    .then((res) => {
      console.log("POST sent! Status:", res.status);
    })
    .catch((err) => {
      console.error("Error:", err.message);
    });

  return json({ success: true, count: allOrders.length });
};
