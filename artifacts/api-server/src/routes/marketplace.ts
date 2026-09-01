import { count, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateOrderBody,
  CreateProductBody,
  CreateProductResponse,
  CreateOrderResponse,
  DeleteProductParams,
  GetAdminSummaryResponse,
  GetProductParams,
  GetProductResponse,
  ListOrdersQueryParams,
  ListOrdersResponse,
  ListProductsQueryParams,
  ListProductsResponse,
  UpdateOrderStatusBody,
  UpdateOrderStatusParams,
  UpdateOrderStatusResponse,
  UpdateProductBody,
  UpdateProductParams,
  UpdateProductResponse,
} from "@workspace/api-zod";
import { db, orderItemsTable, ordersTable, productsTable } from "@workspace/db";

const router: IRouter = Router();
const statuses = ["New", "Processing", "Shipped", "Completed", "Cancelled"] as const;

function asMoney(value: string | number): number {
  return Number(Number(value).toFixed(2));
}

function productResponse(product: typeof productsTable.$inferSelect) {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    price: asMoney(product.price),
    icon: product.icon,
    imageUrl: product.imageUrl,
    createdAt: product.createdAt.toISOString(),
  };
}

type OrderWithItems = typeof ordersTable.$inferSelect & {
  items: Array<
    Pick<
      typeof orderItemsTable.$inferSelect,
      "productId" | "productName" | "price" | "quantity"
    >
  >;
};

function orderResponse(order: OrderWithItems) {
  return {
    id: order.id,
    customerName: order.customerName,
    email: order.email,
    phone: order.phone,
    address: order.address,
    total: asMoney(order.total),
    status: order.status,
    createdAt: order.createdAt.toISOString(),
    items: order.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      price: asMoney(item.price),
      quantity: item.quantity,
    })),
  };
}

async function getOrders(limit: number) {
  const orders = await db
    .select()
    .from(ordersTable)
    .orderBy(desc(ordersTable.createdAt))
    .limit(limit);
  if (orders.length === 0) {
    return [];
  }

  const orderIds = orders.map((order) => order.id);
  const items = await db
    .select()
    .from(orderItemsTable)
    .where(inArray(orderItemsTable.orderId, orderIds));
  const itemsByOrder = new Map<number, typeof items>();
  for (const item of items) {
    const existing = itemsByOrder.get(item.orderId) ?? [];
    existing.push(item);
    itemsByOrder.set(item.orderId, existing);
  }

  return orders.map((order) =>
    orderResponse({ ...order, items: itemsByOrder.get(order.id) ?? [] }),
  );
}

export async function initializeMarketplace(): Promise<void> {
  const [{ value: productCount }] = await db
    .select({ value: count() })
    .from(productsTable);
  if (productCount > 0) {
    return;
  }

  await db.insert(productsTable).values([
    {
      name: "Wireless Headphones",
      description: "Comfortable headphones for everyday listening.",
      price: "49.99",
      icon: "Headphones",
      imageUrl: "",
    },
    {
      name: "Smart Watch",
      description: "Track your day from your wrist.",
      price: "79.99",
      icon: "Watch",
      imageUrl: "",
    },
    {
      name: "Travel Backpack",
      description: "A roomy companion for work and travel.",
      price: "39.99",
      icon: "Backpack",
      imageUrl: "",
    },
  ]);
}

router.get("/products", async (req, res): Promise<void> => {
  const parsed = ListProductsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const search = parsed.data.search?.trim();
  const products = search
    ? await db
        .select()
        .from(productsTable)
        .where(ilike(productsTable.name, `%${search}%`))
        .orderBy(desc(productsTable.createdAt))
    : await db.select().from(productsTable).orderBy(desc(productsTable.createdAt));
  res.json(ListProductsResponse.parse(products.map(productResponse)));
});

router.post("/products", async (req, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [product] = await db
    .insert(productsTable)
    .values({
      name: parsed.data.name.trim(),
      description: parsed.data.description ?? "",
      price: parsed.data.price.toFixed(2),
      icon: parsed.data.icon ?? "Sparkles",
      imageUrl: parsed.data.imageUrl ?? "",
    })
    .returning();
  res.status(201).json(CreateProductResponse.parse(productResponse(product)));
});

router.get("/products/:productId", async (req, res): Promise<void> => {
  const parsed = GetProductParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [product] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, parsed.data.productId));
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  res.json(GetProductResponse.parse(productResponse(product)));
});

router.patch("/products/:productId", async (req, res): Promise<void> => {
  const params = UpdateProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updates: Partial<typeof productsTable.$inferInsert> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name.trim();
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.price !== undefined) updates.price = parsed.data.price.toFixed(2);
  if (parsed.data.icon !== undefined) updates.icon = parsed.data.icon;
  if (parsed.data.imageUrl !== undefined) updates.imageUrl = parsed.data.imageUrl;
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "At least one product field is required" });
    return;
  }
  const [product] = await db
    .update(productsTable)
    .set(updates)
    .where(eq(productsTable.id, params.data.productId))
    .returning();
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  res.json(UpdateProductResponse.parse(productResponse(product)));
});

router.delete("/products/:productId", async (req, res): Promise<void> => {
  const parsed = DeleteProductParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [product] = await db
    .delete(productsTable)
    .where(eq(productsTable.id, parsed.data.productId))
    .returning();
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/orders", async (req, res): Promise<void> => {
  const parsed = ListOrdersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  res.json(ListOrdersResponse.parse(await getOrders(parsed.data.limit ?? 20)));
});

router.post("/orders", async (req, res): Promise<void> => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const requestedIds = parsed.data.items.map((item) => item.productId);
  const products = await db
    .select()
    .from(productsTable)
    .where(inArray(productsTable.id, requestedIds));
  const productsById = new Map(products.map((product) => [product.id, product]));
  const missingId = requestedIds.find((id) => !productsById.has(id));
  if (missingId !== undefined) {
    res.status(400).json({ error: `Product ${missingId} is no longer available` });
    return;
  }

  const order = await db.transaction(async (tx) => {
    const lineItems = parsed.data.items.map((item) => {
      const product = productsById.get(item.productId)!;
      return {
        productId: product.id,
        productName: product.name,
        price: asMoney(product.price),
        quantity: item.quantity,
      };
    });
    const total = lineItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    const [created] = await tx
      .insert(ordersTable)
      .values({
        customerName: parsed.data.customerName.trim(),
        email: parsed.data.email,
        phone: parsed.data.phone ?? "",
        address: parsed.data.address.trim(),
        total: total.toFixed(2),
      })
      .returning();
    await tx.insert(orderItemsTable).values(
      lineItems.map((item) => ({
        orderId: created.id,
        ...item,
        price: item.price.toFixed(2),
      })),
    );
    return { ...created, items: lineItems.map((item) => ({ ...item, price: item.price.toFixed(2) })) };
  });
  res.status(201).json(CreateOrderResponse.parse(orderResponse(order)));
});

router.patch("/orders/:orderId/status", async (req, res): Promise<void> => {
  const params = UpdateOrderStatusParams.safeParse(req.params);
  const parsed = UpdateOrderStatusBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "A valid order id and status are required" });
    return;
  }
  const [updated] = await db
    .update(ordersTable)
    .set({ status: parsed.data.status })
    .where(eq(ordersTable.id, params.data.orderId))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  const items = await db
    .select()
    .from(orderItemsTable)
    .where(eq(orderItemsTable.orderId, updated.id));
  res.json(UpdateOrderStatusResponse.parse(orderResponse({ ...updated, items })));
});

router.get("/admin/summary", async (_req, res): Promise<void> => {
  const [{ value: productCount }] = await db
    .select({ value: count() })
    .from(productsTable);
  const [{ value: orderCount }] = await db
    .select({ value: count() })
    .from(ordersTable);
  const [{ value: revenue }] = await db
    .select({ value: sql<string>`coalesce(sum(${ordersTable.total}), 0)` })
    .from(ordersTable)
    .where(sql`${ordersTable.status} <> 'Cancelled'`);
  const grouped = await db
    .select({ status: ordersTable.status, value: count() })
    .from(ordersTable)
    .groupBy(ordersTable.status);
  const statusCounts = Object.fromEntries(statuses.map((status) => [status, 0]));
  for (const row of grouped) statusCounts[row.status] = row.value;
  res.json(
    GetAdminSummaryResponse.parse({
      productCount,
      orderCount,
      revenue: asMoney(revenue),
      statusCounts,
    }),
  );
});

export default router;