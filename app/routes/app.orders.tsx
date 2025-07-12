import { useState, useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  DataTable,
  Text,
  Button,
  BlockStack,
  InlineStack,
  Badge,
  Select,
  TextField,
  Pagination,
  Spinner,
  EmptyState,
  Thumbnail,
  Link,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

interface Order {
  id: string;
  name: string;
  createdAt: string;
  displayFulfillmentStatus: string;
  displayFinancialStatus: string;
  totalPriceSet: {
    shopMoney: {
      amount: string;
      currencyCode: string;
    };
  };
  customer: {
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  lineItems: {
    edges: Array<{
      node: {
        title: string;
        quantity: number;
        variant: {
          price: string;
          image: {
            url: string;
          } | null;
        } | null;
      };
    }>;
  };
}

interface LoaderData {
  orders: Order[];
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  // totalCount removed
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  let admin;
  try {
    const auth = await authenticate.admin(request);
    admin = auth.admin;
  } catch (err: any) {
    const url = new URL(request.url);
    throw Response.redirect(
      `/auth/login?returnTo=${encodeURIComponent(url.pathname + url.search)}`,
      302,
    );
  }

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor") || null;
  const limit = parseInt(url.searchParams.get("limit") || "10");
  const status = url.searchParams.get("status") || null;
  const search = url.searchParams.get("search") || null;

  // Build the query based on filters
  let query = `#graphql
    query getOrders($first: Int!, $after: String, $query: String) {
      orders(first: $first, after: $after, query: $query) {
        edges {
          node {
            id
            name
            createdAt
            displayFulfillmentStatus
            displayFinancialStatus
            totalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            customer {
              firstName
              lastName
              email
            }
            lineItems(first: 5) {
              edges {
                node {
                  title
                  quantity
                  variant {
                    price
                    image {
                      url
                    }
                  }
                }
              }
            }
          }
          cursor
        }
        pageInfo {
          hasNextPage
          hasPreviousPage
        }
      }
    }`;

  let variables: any = {
    first: limit,
    after: cursor,
  };

  // Build query string for filtering
  let queryString = "";
  if (status && status !== "all") {
    queryString += `status:${status} `;
  }
  if (search) {
    queryString += `name:*${search}* OR customer_email:*${search}* `;
  }

  if (queryString) {
    variables.query = queryString.trim();
  }

  const response = await admin.graphql(query, { variables });
  const responseJson = await response.json();

  const orders = responseJson.data.orders.edges.map((edge: any) => edge.node);
  console.log("zaghum", orders);
  const pageInfo = responseJson.data.orders.pageInfo;
  // Remove totalCount

  return json<LoaderData>({
    orders,
    hasNextPage: pageInfo.hasNextPage,
    hasPreviousPage: pageInfo.hasPreviousPage,
    // Remove totalCount
  });
};

export default function Orders() {
  const { orders, hasNextPage, hasPreviousPage } = useLoaderData<LoaderData>();
  const fetcher = useFetcher();
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [limit, setLimit] = useState(10);

  const getStatusBadge = (status: string) => {
    const statusColors: {
      [key: string]: "success" | "warning" | "critical" | "info";
    } = {
      fulfilled: "success",
      unfulfilled: "warning",
      cancelled: "critical",
      partial: "info",
    };
    return (
      <Badge tone={statusColors[status.toLowerCase()] || "info"}>
        {status}
      </Badge>
    );
  };

  const getFinancialStatusBadge = (status: string) => {
    const statusColors: {
      [key: string]: "success" | "warning" | "critical" | "info";
    } = {
      paid: "success",
      unpaid: "warning",
      refunded: "critical",
      partially_refunded: "info",
    };
    return (
      <Badge tone={statusColors[status.toLowerCase()] || "info"}>
        {status}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatPrice = (amount: string, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(parseFloat(amount));
  };

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (searchTerm) params.set("search", searchTerm);
    params.set("limit", limit.toString());

    fetcher.load(`/app/orders?${params.toString()}`);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // In a real implementation, you'd use cursors for pagination
    // For now, we'll just reload with current filters
    handleSearch();
  };

  const rows = orders.map((order) => [
    <Link
      key={order.id}
      url={`shopify:admin/orders/${order.id.replace("gid://shopify/Order/", "")}`}
      target="_blank"
    >
      {order.name}
    </Link>,
    order.customer
      ? `${order.customer.firstName} ${order.customer.lastName}`
      : "Guest",
    formatDate(order.createdAt),
    getStatusBadge(order.displayFulfillmentStatus),
    getFinancialStatusBadge(order.displayFinancialStatus),
    formatPrice(
      order.totalPriceSet.shopMoney.amount,
      order.totalPriceSet.shopMoney.currencyCode,
    ),
    order.lineItems.edges.length > 0 ? (
      <InlineStack gap="200">
        {order.lineItems.edges.slice(0, 3).map((item, index) => (
          <Thumbnail
            key={index}
            source={item.node.variant?.image?.url || ""}
            alt={item.node.title}
            size="small"
          />
        ))}
        {order.lineItems.edges.length > 3 && (
          <Text as="span" variant="bodySm" tone="subdued">
            +{order.lineItems.edges.length - 3} more
          </Text>
        )}
      </InlineStack>
    ) : (
      <Text as="span" variant="bodySm" tone="subdued">
        No items
      </Text>
    ),
  ]);

  if (fetcher.state === "submitting") {
    return (
      <Page>
        <TitleBar title="Orders" />
        <Layout>
          <Layout.Section>
            <Card>
              <div style={{ textAlign: "center", padding: "2rem" }}>
                <Spinner size="large" />
                <Text as="p" variant="bodyMd">
                  Loading orders...
                </Text>
              </div>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page>
      <TitleBar title="Orders" />
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack gap="400" align="space-between">
                  <Text as="h2" variant="headingMd">
                    Orders ({orders.length})
                  </Text>
                  <Button
                    onClick={handleSearch}
                    loading={fetcher.state === "loading"}
                  >
                    Refresh
                  </Button>
                </InlineStack>

                <InlineStack gap="400" wrap={false}>
                  <div style={{ minWidth: "200px" }}>
                    <Select
                      label="Status"
                      options={[
                        { label: "All Statuses", value: "all" },
                        { label: "Fulfilled", value: "fulfilled" },
                        { label: "Unfulfilled", value: "unfulfilled" },
                        { label: "Cancelled", value: "cancelled" },
                        { label: "Partial", value: "partial" },
                      ]}
                      value={statusFilter}
                      onChange={setStatusFilter}
                    />
                  </div>
                  <div style={{ minWidth: "200px" }}>
                    <TextField
                      label="Search"
                      value={searchTerm}
                      onChange={setSearchTerm}
                      placeholder="Order name or customer email"
                      autoComplete="off"
                    />
                  </div>
                  <div style={{ minWidth: "120px" }}>
                    <Select
                      label="Limit"
                      options={[
                        { label: "10", value: "10" },
                        { label: "25", value: "25" },
                        { label: "50", value: "50" },
                        { label: "100", value: "100" },
                      ]}
                      value={limit.toString()}
                      onChange={(value) => setLimit(parseInt(value))}
                    />
                  </div>
                  <div style={{ alignSelf: "end" }}>
                    <Button onClick={handleSearch} variant="primary">
                      Apply Filters
                    </Button>
                  </div>
                </InlineStack>

                {orders.length === 0 ? (
                  <EmptyState
                    heading="No orders found"
                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  >
                    <p>Try adjusting your search or filter criteria.</p>
                  </EmptyState>
                ) : (
                  <>
                    <DataTable
                      columnContentTypes={[
                        "text",
                        "text",
                        "text",
                        "text",
                        "text",
                        "text",
                        "text",
                      ]}
                      headings={[
                        "Order",
                        "Customer",
                        "Date",
                        "Fulfillment",
                        "Payment",
                        "Total",
                        "Items",
                      ]}
                      rows={rows}
                    />

                    <InlineStack align="center">
                      <Pagination
                        hasPrevious={hasPreviousPage}
                        onPrevious={() => handlePageChange(currentPage - 1)}
                        hasNext={hasNextPage}
                        onNext={() => handlePageChange(currentPage + 1)}
                      />
                    </InlineStack>
                  </>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
