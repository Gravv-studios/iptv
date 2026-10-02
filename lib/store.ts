import {env} from 'cloudflare:workers';
import {DAY,assistantReply,getPlan,type Account,type Snapshot} from './domain';
export function database(){if(!env.DB)throw new Error('DATABASE_UNAVAILABLE');return env.DB;}
export async function initialize(userId:string){
 const db=database(),now=Date.now();
 await db.prepare('INSERT OR IGNORE INTO demo_accounts (user_id,customer_name,plan_id,expires_at,username,password,created_at) VALUES (?,?,?,?,?,?,?)').bind(userId,'Cliente de exemplo','mensal',now+7*DAY,'lume_demo','DEMO-sem-acesso',now).run();
}
export async function snapshot(userId:string):Promise<Snapshot>{
 const db=database(),now=Date.now();
 await db.prepare("UPDATE demo_orders SET status='expired' WHERE user_id=? AND status='pending' AND expires_at<=?").bind(userId,now).run();
 const results=await db.batch([
  db.prepare('SELECT * FROM demo_accounts WHERE user_id=?').bind(userId),
  db.prepare('SELECT id,plan_id,amount,days,method,kind,status,created_at,expires_at,paid_at,applied FROM demo_orders WHERE user_id=? ORDER BY created_at DESC LIMIT 100').bind(userId),
  db.prepare('SELECT id,role,body,created_at FROM demo_messages WHERE user_id=? ORDER BY created_at DESC LIMIT 40').bind(userId)
 ]);
 return {account:results[0].results[0] as Account,orders:results[1].results as Snapshot['orders'],messages:results[2].results.reverse() as Snapshot['messages'],authenticated:true,mode:'demo',serverNow:now};
}
export async function createOrder(userId:string,planId:string,method:string,key:string){
 const plan=getPlan(planId);if(!plan||!['pix','card'].includes(method)||!/^[-\w]{8,80}$/.test(key))throw new Error('INVALID_ORDER');
 const db=database(),now=Date.now(),id=crypto.randomUUID();
 const account=await db.prepare('SELECT * FROM demo_accounts WHERE user_id=?').bind(userId).first<Account>();
 if(!account)throw new Error('ACCOUNT_NOT_FOUND');
 await db.prepare("INSERT OR IGNORE INTO demo_orders (id,user_id,request_key,plan_id,amount,days,method,kind,status,created_at,expires_at,applied) VALUES (?,?,?,?,?,?,?,?,?,?,?,0)").bind(id,userId,key,plan.id,plan.amount,plan.days,method,account.expires_at>0?'renewal':'purchase','pending',now,now+30*60000).run();
 const order=await db.prepare('SELECT id FROM demo_orders WHERE user_id=? AND request_key=?').bind(userId,key).first<{id:string}>();
 return order!.id;
}
// Demo payment and fulfillment run atomically. No production provider is invoked.
export async function confirmOrder(userId:string,id:string){
 const db=database(),now=Date.now();
 const order=await db.prepare('SELECT * FROM demo_orders WHERE user_id=? AND id=?').bind(userId,id).first<{status:string;expires_at:number}>();
 if(!order)throw new Error('ORDER_NOT_FOUND');
 if(order.status==='paid')return;
 if(order.status!=='pending'||order.expires_at<=now)throw new Error('ORDER_NOT_PAYABLE');
 await db.batch([
  db.prepare("UPDATE demo_orders SET status='paid',paid_at=? WHERE user_id=? AND id=? AND status='pending' AND expires_at>?").bind(now,userId,id,now),
  db.prepare("UPDATE demo_accounts SET plan_id=(SELECT plan_id FROM demo_orders WHERE user_id=? AND id=?),expires_at=MAX(expires_at,?)+(SELECT days FROM demo_orders WHERE user_id=? AND id=?)*86400000,username='lume_demo',password='DEMO-sem-acesso' WHERE user_id=? AND EXISTS (SELECT 1 FROM demo_orders WHERE user_id=? AND id=? AND status='paid' AND applied=0)").bind(userId,id,now,userId,id,userId,userId,id),
  db.prepare("UPDATE demo_orders SET applied=1 WHERE user_id=? AND id=? AND status='paid' AND applied=0").bind(userId,id)
 ]);
}
export async function cancelOrder(userId:string,id:string){await database().prepare("UPDATE demo_orders SET status='cancelled' WHERE user_id=? AND id=? AND status='pending'").bind(userId,id).run();}
export async function resetDemo(userId:string,newCustomer:boolean){
 const db=database(),now=Date.now();
 await db.batch([
  db.prepare('DELETE FROM demo_orders WHERE user_id=?').bind(userId),
  db.prepare('DELETE FROM demo_messages WHERE user_id=?').bind(userId),
  db.prepare("UPDATE demo_accounts SET plan_id='mensal',expires_at=?,username=?,password=? WHERE user_id=?").bind(newCustomer?0:now+7*DAY,newCustomer?'':'lume_demo',newCustomer?'':'DEMO-sem-acesso',userId)
 ]);
}
export async function sendChat(userId:string,body:string){
 const db=database(),account=await db.prepare('SELECT * FROM demo_accounts WHERE user_id=?').bind(userId).first<Account>();
 if(!account)throw new Error('ACCOUNT_NOT_FOUND');
 const now=Date.now();
 await db.batch([
 db.prepare('INSERT INTO demo_messages (id,user_id,role,body,created_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),userId,'user',body,now),
 db.prepare('INSERT INTO demo_messages (id,user_id,role,body,created_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),userId,'assistant',assistantReply(body,account,now),now+1)
 ]);
}
