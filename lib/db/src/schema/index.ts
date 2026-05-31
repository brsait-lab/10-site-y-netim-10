import {
  doublePrecision,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const sitesTable = pgTable("sites", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull().default(""),
  adminId: text("admin_id").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull(),
  siteId: text("site_id").notNull(),
  status: text("status").notNull().default("pending"),
  phone: text("phone").notNull().default(""),
  unitNo: text("unit_no"),
  plates: text("plates").array(),
  businessName: text("business_name"),
  businessCategory: text("business_category"),
  businessDescription: text("business_description"),
  businessAddress: text("business_address"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const notificationsTable = pgTable("notifications", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  fromUserId: text("from_user_id").notNull(),
  fromName: text("from_name").notNull(),
  toRoles: text("to_roles").array(),
  toUserIds: text("to_user_ids").array(),
  siteId: text("site_id").notNull(),
  readBy: text("read_by")
    .array()
    .notNull()
    .default(sql`ARRAY[]::text[]`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const paymentsTable = pgTable("payments", {
  id: text("id").primaryKey(),
  siteId: text("site_id").notNull(),
  title: text("title").notNull(),
  amount: doublePrecision("amount").notNull(),
  dueDate: text("due_date").notNull(),
  type: text("type").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const userPaymentsTable = pgTable("user_payments", {
  id: text("id").primaryKey(),
  paymentId: text("payment_id").notNull(),
  userId: text("user_id").notNull(),
  siteId: text("site_id").notNull(),
  status: text("status").notNull().default("pending"),
  paidAt: timestamp("paid_at"),
});

export const messagesTable = pgTable("messages", {
  id: text("id").primaryKey(),
  chatId: text("chat_id").notNull(),
  fromId: text("from_id").notNull(),
  fromName: text("from_name").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const packagesTable = pgTable("packages", {
  id: text("id").primaryKey(),
  siteId: text("site_id").notNull(),
  recipientUserId: text("recipient_user_id").notNull(),
  recipientName: text("recipient_name").notNull(),
  senderInfo: text("sender_info").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default("received"),
  receivedAt: timestamp("received_at").notNull().defaultNow(),
  deliveredAt: timestamp("delivered_at"),
});

export type Site = typeof sitesTable.$inferSelect;
export type User = typeof usersTable.$inferSelect;
export type Notification = typeof notificationsTable.$inferSelect;
export type Payment = typeof paymentsTable.$inferSelect;
export type UserPayment = typeof userPaymentsTable.$inferSelect;
export type Message = typeof messagesTable.$inferSelect;
export type Package = typeof packagesTable.$inferSelect;
