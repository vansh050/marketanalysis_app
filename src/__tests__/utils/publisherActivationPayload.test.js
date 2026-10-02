import fs from 'fs';
import path from 'path';
import {parse} from '@babel/parser';
import {isPublisherActivationAcknowledged} from '../../utils/publisherAcknowledgement';
import {createPublisherBatchDispatcher} from '../../utils/publisherBatchDispatch';
function find(n){if(!n||typeof n!=='object')return null;if(n.type==='VariableDeclarator'&&n.id?.name==='recordPublisherIntent')return n.init;for(const v of Object.values(n)){for(const c of Array.isArray(v)?v:[v]){const r=find(c);if(r)return r}}return null;}
const files=['ModelPortfolioComponents/MPReviewTradeModal.js','AdviceScreenComponents/RebalanceModal.js','ModelPortfolioComponents/UserStrategySubscribeModal.js'];
test.each(files)('actual %s caller sends exact phase and checks its grant',async file=>{
 const source=fs.readFileSync(path.resolve(__dirname,'../../components',file),'utf8');const n=find(parse(source,{sourceType:'module',plugins:['jsx']}));
 const full=[{transactionType:'SELL',quantity:4},{transactionType:'BUY',quantity:2}];const buys=[full[1]];let active='a:BUY:1';
 let grantOverride={};
 const axios={post:jest.fn(async(url,payload)=>({data:url.includes('execution-intent')?{intentId:'i',attemptId:'a'}:{status:0,recorded:true,reconciliationEnrolled:true,allowExecution:true,dispatchReserved:true,activationId:active,...grantOverride}}))};
 const scope={axios,publisherIntentFiredRef:{current:false},calculatedPortfolioData:{uniqueId:'u'},userEmail:'customer',
  configData:{subdomain:'markup'},getAdvisorSubdomain:()=> 'markup',Config:{},generateToken:()=> 'test',PUBLISHER_ACK_TIMEOUT_MS:15000,
  latestRebalance:{model_Id:'m'},strategyDetails:{model_name:'Flex',advisor:'Markup'},frozenPlanFields:{plan_id:'p',plan_version:1},
  additionalPayload:{unique_id:'u',plan_id:'p',plan_version:1},modelPortfolioModelId:'m',storeModalName:'Flex',advisorTag:'Markup',publisherHeaders:()=>({}),
  server:{ccxtServer:{baseUrl:'/'},server:{baseUrl:'/'}},isPublisherActivationAcknowledged,
  getTenantSubdomain:()=> 'markup', voidUnsentPublisherRecos:jest.fn().mockResolvedValue(undefined),
  handleStaleExecutionBundle:jest.fn().mockResolvedValue(undefined), executionBundleHeaders:()=>({}),
  publisherContinuationContextRef:{current:null}};
 const record=new Function('scope',`with(scope){return (${source.slice(n.start,n.end)});}`)(scope);
 await record(full,{attemptId:'a'},buys,'a:BUY:1');
 expect(axios.post.mock.calls[1][1]).toMatchObject({legs:full,activation_legs:buys,activation_id:'a:BUY:1',prepare_only:false});
 active='wrong';await expect(record(full,{attemptId:'a'},buys,'a:BUY:1')).rejects.toThrow();
 active='a:BUY:1';
 const open=jest.fn();
 const dispatcher=createPublisherBatchDispatcher();
 const args={attemptId:'a',index:1,legs:buys,
   authorize:id=>record(full,{attemptId:'a'},buys,id),open};
 for (const refusal of [{allowExecution:false},{dispatchReserved:false},
   {recorded:false},{reconciliationEnrolled:false},{status:1}]) {
   grantOverride=refusal;
   await expect(dispatcher.run(args)).rejects.toThrow();
   expect(open).not.toHaveBeenCalled();
 }
 grantOverride={};
 await dispatcher.run(args);
 expect(open).toHaveBeenCalledTimes(1);
 await expect(dispatcher.run(args)).rejects.toThrow('already');
 expect(open).toHaveBeenCalledTimes(1);
});
