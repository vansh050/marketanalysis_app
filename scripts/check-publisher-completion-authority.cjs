const fs=require('fs'),assert=require('assert'),vm=require('vm');
const root=process.argv[2]||process.cwd();
const helper=fs.readFileSync(root+'/src/utils/publisherCompletionAuthority.js','utf8');
const ctx={};vm.createContext(ctx);vm.runInContext(helper.replace(/export function /g,'function '),ctx);
const approved=Array.from({length:25},(_,i)=>({symbol:'S'+i,transactionType:'BUY',quantity:1}));
const rows=approved.slice(0,19).map(r=>({...r,orderStatus:'COMPLETE'}));
assert(!ctx.isPublisherExecutionComplete({status:0,intentLifecycle:{total:25,successful:19,all_terminal:false}}));
assert.equal(ctx.includeUnconfirmedPublisherLegs(rows,approved).length,25);
assert(ctx.includeUnconfirmedPublisherLegs(rows,approved).slice(19).every(r=>r.orderStatus==='PENDING_CONFIRMATION'));
assert(ctx.isPublisherExecutionComplete({status:0,intentLifecycle:{total:25,successful:25,all_terminal:true}}));
assert(!ctx.isPublisherExecutionComplete({status:2,intentLifecycle:{total:25,successful:25,all_terminal:true}}));
for(const file of ['AdviceScreenComponents/RebalanceModal.js','ModelPortfolioComponents/MPReviewTradeModal.js']){
 const source=fs.readFileSync(root+'/src/components/'+file,'utf8');
 assert(!source.includes('pubSuccessCount ==='),'callback-local count still decides completion');
 assert(source.includes('isPublisherExecutionComplete(backendRecordBody)'));
 assert(source.includes('includeUnconfirmedPublisherLegs('));
}
console.log('PASS: 19/25, missing legs, backend proof, error fail-closed, both mobile callback guards');
