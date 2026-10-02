import {sqliteTable,text,integer,index,uniqueIndex} from 'drizzle-orm/sqlite-core';
export const accounts=sqliteTable('demo_accounts',{
 userId:text('user_id').primaryKey(),customerName:text('customer_name').notNull(),
 planId:text('plan_id').notNull(),expiresAt:integer('expires_at').notNull(),
 username:text('username').notNull(),password:text('password').notNull(),
 createdAt:integer('created_at').notNull()
});
export const orders=sqliteTable('demo_orders',{
 id:text('id').primaryKey(),userId:text('user_id').notNull(),requestKey:text('request_key').notNull(),
 planId:text('plan_id').notNull(),amount:integer('amount').notNull(),days:integer('days').notNull(),
 method:text('method').notNull(),kind:text('kind').notNull(),status:text('status').notNull(),
 createdAt:integer('created_at').notNull(),expiresAt:integer('expires_at').notNull(),
 paidAt:integer('paid_at'),applied:integer('applied').notNull().default(0)
},t=>[index('idx_demo_orders_user_created').on(t.userId,t.createdAt),uniqueIndex('idx_demo_orders_request').on(t.userId,t.requestKey)]);
export const messages=sqliteTable('demo_messages',{
 id:text('id').primaryKey(),userId:text('user_id').notNull(),role:text('role').notNull(),
 body:text('body').notNull(),createdAt:integer('created_at').notNull()
},t=>[index('idx_demo_messages_user_created').on(t.userId,t.createdAt)]);
