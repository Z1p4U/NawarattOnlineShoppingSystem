import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const esbuildPath = readdirSync('node_modules/.pnpm').find(x => x.startsWith('esbuild@0.27.'));
const { build } = require(resolve(`node_modules/.pnpm/${esbuildPath}/node_modules/esbuild/lib/main.js`));
const sqlite = new DatabaseSync(':memory:');
for (const file of readdirSync('drizzle').filter(x => x.endsWith('.sql')).sort()) sqlite.exec(readFileSync(join('drizzle',file),'utf8'));
const d1 = {
  prepare(query) {
    let params = [];
    return { bind(...p) { params = p; return this; },
      async raw() { const s=sqlite.prepare(query); s.setReturnArrays(true); return s.all(...params); },
      async all() { const s=sqlite.prepare(query); return {results:s.all(...params),success:true,meta:{}}; },
      async run() { const r=sqlite.prepare(query).run(...params); return {success:true,results:[],meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}}; },
    };
  },
  async batch(statements) { sqlite.exec('BEGIN'); try { const rows=[]; for(const s of statements) rows.push(await s.all()); sqlite.exec('COMMIT'); return rows; } catch(e) {sqlite.exec('ROLLBACK'); throw e;} },
};
globalThis.__financeTest={d1,role:'admin'};
const dir=mkdtempSync(join(tmpdir(),'finance-adjustments-'));
try {
 const outfile=join(dir,'routes.mjs');
 await build({ stdin:{contents:'export * as adjustments from "./app/api/balance-adjustments/route.ts"; export * as opening from "./app/api/opening-balances/route.ts"; export * as payments from "./app/api/payments/route.ts";',resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',outfile,plugins:[{name:'test-runtime',setup(b){
   b.onResolve({filter:/^(\.\.\/)+db$/},()=>({path:'db',namespace:'test'}));
   b.onResolve({filter:/lib\/app-user$/},()=>({path:'user',namespace:'test'}));
   b.onLoad({filter:/.*/,namespace:'test'},args=>({resolveDir:process.cwd(),contents:args.path==='db' ? 'import {drizzle} from "drizzle-orm/d1"; export function getDb(){return drizzle(globalThis.__financeTest.d1)}' : 'export async function getAppUser(){ const role=globalThis.__financeTest.role; return role ? {role,email:"test@example.test",displayName:"QA Admin"}:null; } export function roleAllowed(role,allowed){return role==="admin"||allowed.includes(role)}',loader:'js'}));
 }}]});
 const {adjustments,opening,payments}=await import(outfile);
 sqlite.exec(`insert into customers(customer_key,customer_name,township,salesperson,created_by) values('qa|||yangon','QA','Yangon','Admin','QA'); insert into customer_opening_balances(customer_key,customer_name,township,as_of_date,opening_outstanding,entered_by) values('qa|||yangon','QA','Yangon','2026-10-26',500000,'QA');`);
 const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Yangon'});
 const post=(payload)=>adjustments.POST(new Request('https://test/api/balance-adjustments',{method:'POST',body:JSON.stringify(payload)}));
 let payload={id:crypto.randomUUID(),customerKey:'qa|||yangon',amount:-20000,beforeBalance:500000,adjustmentDate:today,reason:'Verified ledger difference'};
 for(const role of [null,'finance','sale','warehouse','delivery','purchase','viewer']) {globalThis.__financeTest.role=role; assert.equal((await post(payload)).status,role?403:401);}
 globalThis.__financeTest.role='admin';
 assert.equal((await post({...payload,reason:''})).status,400);
 { const r=await post(payload); const body=await r.json(); assert.equal(r.status,200,JSON.stringify(body)); }
 assert.equal((await post(payload)).status,200); // retry is idempotent
 assert.equal(sqlite.prepare('select count(*) n from balance_adjustments').get().n,1);
 let response=await opening.GET(); let data=await response.json();
 assert.equal(data.balances.find(x=>x.customerKey==='qa|||yangon').adjustmentAmount,-20000);
 assert.equal((await post({...payload,id:crypto.randomUUID(),beforeBalance:500000})).status,409);
 const reverse={...payload,id:crypto.randomUUID(),amount:1,beforeBalance:480000,reversalOf:payload.id,reason:'Reverse correction'};
 assert.equal((await post(reverse)).status,200);
 assert.equal(sqlite.prepare('select sum(amount) n from balance_adjustments').get().n,0);
 assert.equal((await post({...reverse,id:crypto.randomUUID(),beforeBalance:500000})).status,400);
 assert.equal(sqlite.prepare('select count(*) n from payment_transactions').get().n,0);
 assert.equal(sqlite.prepare('select opening_outstanding n from customer_opening_balances').get().n,500000);
 const patch=(body)=>opening.PATCH(new Request('https://test/api/opening-balances',{method:'PATCH',body:JSON.stringify(body)}));
 const id=sqlite.prepare('select id from customer_opening_balances').get().id;
 globalThis.__financeTest.role='finance'; assert.equal((await patch({id,salesperson:'Myo Min'})).status,403);
 globalThis.__financeTest.role='admin'; assert.equal((await patch({id,salesperson:'Myo Min'})).status,200);
 assert.equal(sqlite.prepare('select salesperson from customers').get().salesperson,'Myo Min');
 assert.equal(sqlite.prepare("select count(*) n from audit_logs where action='balance_adjustment'").get().n,2);
 const increased={...payload,id:crypto.randomUUID(),amount:20000,beforeBalance:500000};
 assert.equal((await post(increased)).status,200);
 sqlite.exec(`insert into payment_transactions(order_id,customer_name,township,amount,method,payment_date,entered_by) values(0,'QA','Yangon',510000,'cash','${today}','QA');`);
 const paymentId=sqlite.prepare('select id from payment_transactions').get().id;
 const paymentResponse=await payments.PATCH(new Request('https://test/api/payments',{method:'PATCH',body:JSON.stringify({id:paymentId,amount:510000,method:'cash',paymentDate:today,reason:'Allocate adjusted debt'})}));
 assert.equal(paymentResponse.status,200,JSON.stringify(await paymentResponse.json()));
 assert.equal(sqlite.prepare('select paid_amount n from customer_opening_balances').get().n,510000);
 assert.equal((await patch({id,salesperson:'Zaw Tun Kyaw',openingOutstanding:500000,paidAmount:510000})).status,200);
 assert.equal(sqlite.prepare('select paid_amount n from customer_opening_balances').get().n,510000);
 sqlite.exec("insert into customers(customer_key,customer_name,township,salesperson,created_by) values('new|||yangon','New','Yangon','Admin','QA')");
 assert.equal((await post({...payload,id:crypto.randomUUID(),customerKey:'new|||yangon',amount:10000,beforeBalance:0})).status,200);
 const newOpening=sqlite.prepare("select opening_outstanding,paid_amount from customer_opening_balances where customer_key='new|||yangon'").get();
 assert.equal(newOpening.opening_outstanding,0); assert.equal(newOpening.paid_amount,0);

 console.log('PASS: Admin permissions, required reason, signed balance, stale balance rejection, idempotency, reversal uniqueness, payment isolation, opening preservation, salesperson update and audit.');
} finally {sqlite.close();rmSync(dir,{recursive:true,force:true});delete globalThis.__financeTest;}
