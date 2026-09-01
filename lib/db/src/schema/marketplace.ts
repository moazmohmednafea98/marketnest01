import { relations } from "drizzle-orm";
import {
  integer,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const orderStatusEnum = pgEnum("order_status", [
  "New",
  "Processing",
  "Shipped",
  "Completed",
  "Cancelled",
]);

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  icon: text("icon").notNull().default(""),
  imageUrl: text("image_url").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  customerName: text("customer_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull().default(""),
  address: text("address").notNull(),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  status: orderStatusEnum("status").notNull().default("New"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orderItemsTable = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => ordersTable.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull(),
  productName: text("product_name").notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  quantity: integer("quantity").notNull(),
});

export const productsRelations = relations(productsTable, ({ many }) => ({
  orderItems: many(orderItemsTable),
}));

export const ordersRelations = relations(ordersTable, ({ many }) => ({
  items: many(orderItemsTable),
}));

export const orderItemsRelations = relations(orderItemsTable, ({ one }) => ({
  order: one(ordersTable, {
    fields: [orderItemsTable.orderId],
    references: [ordersTable.id],
  }),
}));

export const insertProductSchema = createInsertSchema(productsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertProduct = typeof productsTable.$inferInsert;
export type Product = typeof productsTable.$inferSelect;
export type Order = typeof ordersTable.$inferSelect;
export type OrderItem = typeof orderItemsTable.$inferSelect;