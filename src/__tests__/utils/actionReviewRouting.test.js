import fs from 'fs';
import path from 'path';
import {parse} from '@babel/parser';
import {hasVerifiedExecutionCompletion} from '../../utils/modelPortfolioExecution';
import {normalizeRepairResponse} from '../../utils/rebalanceReconciliation';
import {accountRecoveryTitle, holdingsReviewCanResolve} from '../../utils/accountRecoveryUx';
import {isPublisherLegTerminal} from '../../utils/publisherOrderLabel';

const card=fs.readFileSync(path.resolve(__dirname,'../../UIComponents/RebalanceAdvicesUI/RebalanceCard.js'),'utf8');

test.each([
 ['broker_attribution_ambiguous','ownership_conflict','Portfolio holdings need review'],
 ['execution_not_terminal','orders_unresolved','Broker order status is pending'],
 ['broker_snapshot_unavailable','broker_verification_failed','Broker holdings check failed'],
])('account recovery title names %s', (reason,state,title) => {
 expect(accountRecoveryTitle({reason,state})).toBe(title);
});

const find=(node,name)=>{
 if(!node||typeof node!=='object')return null;
 if(node.type==='VariableDeclarator'&&node.id?.name===name)return node.init;
 for(const value of Object.values(node))for(const child of Array.isArray(value)?value:[value]){
  const found=find(child,name);if(found)return found;
 }
 return null;
};
const extract=(source,name,scope)=>{
 const node=find(parse(source,{sourceType:'module',plugins:['jsx']}),name);
 return new Function('scope',`with(scope){return (${source.slice(node.start,node.end)});}`)(scope);
};
const setup=(models=[])=>{
 const scope={
  actionOpeningRef:{current:false},pendingActionRef:{current:null},skipRepairRef:{current:false},tapReadSessionRef:{current:null},speculativeProbeRef:{current:null},restartSequentialRef:{current:null},
  isRebalanceExecuted:false,isPartiallyExecuted:false,isPendingVerification:false,isRepairMode:false,
  broker:'Zerodha',brokerStatus:'connected',BROKER_PROBE_REUSE_MS:30000,jwtToken:'old',data:{model_Id:'r'},modelName:'Model',userExecution:{status:'toExecute'},
  selectedRepairPortfolios:[{model_name:'Model'}], matchingFailedTrades:null,
  refreshBrokerStatus:jest.fn().mockResolvedValue({broker:'Zerodha',brokerStatus:'connected',funds:{data:{availablecash:100}}}),
  getModelPortfolioRepairTrades:jest.fn().mockResolvedValue(normalizeRepairResponse({models})),
  getRecentRepairResult:jest.fn(()=>null),acceptTimingStart:()=>{},acceptTimingMark:()=>{},
  handleAcceptClick:jest.fn(), handlePendingRefresh:jest.fn(),handleCheckStatus:jest.fn(),handleCheckBroker:jest.fn(),
  Toast:{show:jest.fn()},hasVerifiedExecutionCompletion,console,
  hasRepairTrades:false,
  accountRecoveryTitle,holdingsReviewCanResolve,isPublisherLegTerminal,
  onReviewRebalance:jest.fn().mockResolvedValue(true),
  classifyFundsResponse:()=>({ok:true}), funds:{data:{availablecash:100}},
 };
 for(const key of ['setStoreModalName','setModelPortfolioModelId','setisChangeModal','setLoading','setOpenTokenExpireModel',
 'setBrokerModel','setLocallyResolvedAligned','setCalculatedPortfolioData','setmatchfailed','setmatchingFailedTrades',
 'setRebalanceExecutionStatus','setShowCheckboxModal','setCurrentStep','setOpenRebalanceModal','setStockTypeAndSymbol'])scope[key]=jest.fn();
 scope.discover=extract(card,'handleRepairDiscovery',scope);
 scope.repairDiscoveryRef={current:scope.discover};
 return scope;
};
test('verified fresh action skips holdings and requests direct review',async()=>{
 const s=setup(); await s.discover({allowFresh:true});
 expect(s.handleAcceptClick).toHaveBeenCalledWith({verifiedNoRepair:true});
 s.handleCheckBroker=extract(card,'handleCheckBroker',s);
 await s.handleCheckBroker(false);
 expect(s.onReviewRebalance).toHaveBeenCalledWith({modelName:'Model',modelId:'r',executionStatus:'toExecute',allocationReviewRequested:false,
  liveSession:expect.objectContaining({broker:'Zerodha',brokerStatus:'connected'}),
  brokerReadSession:expect.stringMatching(/^tap_/)});
 expect(s.refreshBrokerStatus).toHaveBeenLastCalledWith({forceNetwork:true,reuseWithinMs:30000});
 expect(s.handleCheckStatus).not.toHaveBeenCalled();
});
test.each([{failedTrades:[{advQTY:2}]},{allocationReviewReady:true,pendingAllocation:{plan_id:'saved',buy:[],sell:[]}}])(
 'discovery preserves exact Repair/saved plan: %j',async action=>{
 const model={modelName:'Model',...action},s=setup([model]);
 await s.discover(); expect(s.handleAcceptClick).toHaveBeenCalledWith(model);
 expect(s.handleCheckBroker).not.toHaveBeenCalled();
});
test('saved allocation actually opens review without Calculate or undefined setters',async()=>{
 const s=setup(), saved={plan_id:'saved',buy:[{symbol:'ABC',quantity:2,exchange:'NSE'}],sell:[]};
 await extract(card,'handleAcceptClick',s)({allocationReviewReady:true,pendingAllocation:saved});
 expect(s.setCalculatedPortfolioData).toHaveBeenCalledWith(expect.objectContaining({plan_id:'saved',_rebalanceModelId:'r'}));
 expect(s.setStockTypeAndSymbol).toHaveBeenCalledWith([{Symbol:'ABC',Type:'BUY',Exchange:'NSE',Quantity:2}]);
 expect(s.handleCheckBroker).toHaveBeenCalledWith(true);
 expect(s.onReviewRebalance).not.toHaveBeenCalled();
});
test('explicit fresh classification passes allocation review intent',async()=>{
 const s=setup([{modelName:'Model',requiresFreshRebalance:true}]);await s.discover();
 expect(s.handleCheckBroker).toHaveBeenCalledWith(false,true);
});
test.each([{unknown:true},{pending:true},{unavailable:true},{superseded:true},null])(
 'unresolved evidence never calculates: %j',async response=>{
 const s=setup();s.getModelPortfolioRepairTrades.mockResolvedValue(response);await s.discover({allowFresh:true});
 expect(s.handleAcceptClick).not.toHaveBeenCalled();expect(s.handleCheckBroker).not.toHaveBeenCalled();
});
test('empty repair evidence does not authorize a new calculation',async()=>{
 const s=setup();await s.discover();expect(s.handleAcceptClick).not.toHaveBeenCalled();
});
test('another model pending does not block this exact verified Repair',async()=>{
 const selected={modelName:'Model',failedTrades:[{advQTY:2}]};
 const s=setup([{modelName:'Other',reconciliationPending:true},selected]);
 await s.discover();expect(s.handleAcceptClick).toHaveBeenCalledWith(selected);
});
test('reconnect precedes discovery and fresh evidence controls resumption',async()=>{
 const s=setup([{modelName:'Model',failedTrades:[{advQTY:1}]}]);
 s.brokerStatus='expired';
 s.refreshBrokerStatus.mockResolvedValueOnce({broker:'Zerodha',brokerStatus:'expired'});
 await s.discover();expect(s.getModelPortfolioRepairTrades).not.toHaveBeenCalled();
 expect(s.setOpenTokenExpireModel).toHaveBeenCalledWith(true);
 await s.discover(s.pendingActionRef.current);
 expect(s.handleAcceptClick).toHaveBeenCalledWith(expect.objectContaining({failedTrades:[{advQTY:1}]}));
});
test('get-repair overlaps the probe for a connected broker; an expired probe discards it',async()=>{
 const s=setup([{modelName:'Model',failedTrades:[{advQTY:1}]}]);
 s.refreshBrokerStatus.mockResolvedValueOnce({broker:'Zerodha',brokerStatus:'expired'});
 await s.discover();
 expect(s.getModelPortfolioRepairTrades).toHaveBeenCalledTimes(1);
 expect(s.setOpenTokenExpireModel).toHaveBeenCalledWith(true);
 expect(s.handleAcceptClick).not.toHaveBeenCalled();
});
test('a broker switch seen by the probe re-runs get-repair for the new broker',async()=>{
 const s=setup([{modelName:'Model',failedTrades:[{advQTY:1}]}]);
 s.refreshBrokerStatus.mockResolvedValueOnce({broker:'Dhan',brokerStatus:'connected'});
 await s.discover();
 expect(s.getModelPortfolioRepairTrades).toHaveBeenCalledTimes(2);
});
test('a clean Home answer under 30 s is reused instead of a second get-repair (2026-10-02)',async()=>{
 const s=setup();
 const recent=normalizeRepairResponse({models:[{modelName:'Model',failedTrades:[{advQTY:3}]}]});
 s.getRecentRepairResult.mockReturnValue(recent);
 await s.discover({allowFresh:true});
 expect(s.getRecentRepairResult).toHaveBeenCalledWith({modelName:'Model',broker:'Zerodha'});
 expect(s.getModelPortfolioRepairTrades).not.toHaveBeenCalled();
 expect(s.handleAcceptClick).toHaveBeenCalledWith(expect.objectContaining({failedTrades:[{advQTY:3}]}));
});
test('a reused answer is dropped when the probe shows a different broker',async()=>{
 const s=setup([{modelName:'Model',failedTrades:[{advQTY:1}]}]);
 s.getRecentRepairResult.mockReturnValue(normalizeRepairResponse({models:[{modelName:'Model',failedTrades:[{advQTY:9}]}]}));
 s.refreshBrokerStatus.mockResolvedValueOnce({broker:'Dhan',brokerStatus:'connected'});
 await s.discover();
 expect(s.getModelPortfolioRepairTrades).toHaveBeenCalledTimes(1);
 expect(s.handleAcceptClick).toHaveBeenCalledWith(expect.objectContaining({failedTrades:[{advQTY:1}]}));
});
test('an expired card never reuses a cached answer',async()=>{
 const s=setup();s.brokerStatus='expired';
 s.refreshBrokerStatus.mockResolvedValueOnce({broker:'Zerodha',brokerStatus:'expired'});
 await s.discover();
 expect(s.getRecentRepairResult).not.toHaveBeenCalled();
 expect(s.setOpenTokenExpireModel).toHaveBeenCalledWith(true);
});
test('TradeContext keeps only clean, same-epoch answers and drops them on reconnect/order',()=>{
 const ctx=fs.readFileSync(path.resolve(__dirname,'../../screens/TradeContext.js'),'utf8');
 expect(ctx).toContain('repair?.accountRecovery?.blocked || requestEpoch !== repairEpochRef.current');
 const handler=ctx.slice(ctx.indexOf('const refreshAccountState = async event => {'));
 expect(handler.slice(0,600)).toContain('repairEpochRef.current += 1;');
 expect(handler.slice(0,600)).toContain('lastRepairResultRef.current = null;');
 expect(ctx).toContain("eventEmitter.on('OrderPlacedReferesh', refreshAccountState)");
 expect(ctx).toContain('Date.now() - cached.at > maxAgeMs');
});
test('one Accept tap sends the same brokerReadSession to get-repair and calculate (2026-10-02)',async()=>{
 const s=setup([{modelName:'Model',requiresFreshRebalance:true}]);
 s.handleCheckBroker=extract(card,'handleCheckBroker',s);
 await s.discover();
 const sent=s.getModelPortfolioRepairTrades.mock.calls[0][1].brokerReadSession;
 expect(sent).toMatch(/^tap_[a-z0-9]{8,}$/);
 expect(s.onReviewRebalance).toHaveBeenCalledWith(expect.objectContaining({brokerReadSession:sent}));
 expect(s.tapReadSessionRef.current).toBeNull();
});
test('calculate forwards brokerReadSession only when the card supplied one',()=>{
 const parentSrc=fs.readFileSync(path.resolve(__dirname,'../../components/AdviceScreenComponents/RebalanceAdvices.js'),'utf8');
 expect(parentSrc).toContain('...(options.brokerReadSession ? {brokerReadSession: options.brokerReadSession} : {}),');
 const ctx=fs.readFileSync(path.resolve(__dirname,'../../screens/TradeContext.js'),'utf8');
 expect(ctx).toContain('...(options.brokerReadSession');
});
test('a calculate path starts before the probe returns and hands the probe forward (2026-10-02)',async()=>{
 const s=setup([{modelName:'Model',requiresFreshRebalance:true}]);
 let release; s.refreshBrokerStatus.mockReturnValueOnce(new Promise(r=>{release=r;}));
 s.handleCheckBroker=extract(card,'handleCheckBroker',s);
 const done=s.discover();
 await new Promise(r=>setTimeout(r,0));await new Promise(r=>setTimeout(r,0));
 expect(s.onReviewRebalance).toHaveBeenCalledWith(expect.objectContaining({
  pendingSession:expect.any(Promise),expectedBroker:'Zerodha'}));
 release({broker:'Zerodha',brokerStatus:'connected',funds:{data:{availablecash:100}}});
 await done;
});
test('a repair review never opens before the probe confirms the broker',async()=>{
 const s=setup([{modelName:'Model',failedTrades:[{advQTY:2}]}]);
 s.refreshBrokerStatus.mockResolvedValueOnce({broker:'Zerodha',brokerStatus:'expired'});
 await s.discover();
 expect(s.handleAcceptClick).not.toHaveBeenCalled();
 expect(s.setOpenTokenExpireModel).toHaveBeenCalledWith(true);
});
test('ownership recovery keeps holdings destination, not Calculate',async()=>{
 const s=setup();s.getModelPortfolioRepairTrades.mockResolvedValue(normalizeRepairResponse({
 accountRecovery:{schemaVersion:1,blocked:true,nextAction:{code:'review_holdings'}}}));
 await s.discover({allowFresh:true});expect(s.handleCheckStatus).toHaveBeenCalledTimes(1);
 expect(s.handleAcceptClick).not.toHaveBeenCalled();
});
test('completed state performs no broker check',async()=>{
 const s=setup();s.isRebalanceExecuted=true;await s.discover();expect(s.refreshBrokerStatus).not.toHaveBeenCalled();
});
test('exact completion after reconnect does not open anything',async()=>{
 const s=setup([{modelName:'Model',executionComplete:true,completionPlanId:'p',completionRecommendationId:'r',
 verificationStatus:'verified_live',failedTrades:[],pendingOrders:[]}]);
 await s.discover();expect(s.setLocallyResolvedAligned).toHaveBeenCalledWith(true);
 expect(s.handleAcceptClick).not.toHaveBeenCalled();
});
test('older recommendation completion cannot complete the current card',async()=>{
 const s=setup([{modelName:'Model',executionComplete:true,completionPlanId:'p',completionRecommendationId:'old',
 verificationStatus:'verified_live',failedTrades:[],pendingOrders:[]}]);
 await s.discover();expect(s.setLocallyResolvedAligned).not.toHaveBeenCalled();
});

const parent=fs.readFileSync(path.resolve(__dirname,'../../components/AdviceScreenComponents/RebalanceAdvices.js'),'utf8');
const parentScope=()=>{
 const s=setup();
 Object.assign(s,{storeModalName:'OLD',modelPortfolioModelId:'old',currentStep:1,
  userEmail:'test@example.invalid',configData:{config:{REACT_APP_ADVISOR_SPECIFIC_TAG:'test',REACT_APP_HEADER_NAME:'test'}},
  apiKey:'',secretKey:'',clientCode:'',viewToken:'',sid:'',serverId:'',angelOneApiKey:'',
  server:{ccxtServer:{baseUrl:'https://example.invalid/'}}, Config:{},
  buildBrokerPayloadFields:()=>({}),defaultDecrypt:()=>'',generateToken:()=>'',selectedOption:'option1',
  availableFundsPayload:()=>({}),
  axios:{request:jest.fn().mockResolvedValue({data:{buy:[{symbol:'ABC',quantity:2,exchange:'NSE'}],sell:[]}})},
  getRebalanceContract:()=>null,isRebalanceErrorResponse:()=>false,checkPortfolioShortfall:()=>({isShortfall:false}),
  getCanonicalRebalanceTrades:data=>data,Alert:{alert:jest.fn()},setModelObjectId:jest.fn(),
 });
 s.calculate=extract(parent,'handleAcceptRebalance',s);
 return s;
};
test('actual parent calculates selected model without stale parent selection or holdings',async()=>{
 const s=parentScope();await s.calculate({directReview:true,modelName:'NEW',modelId:'new',allocationReviewRequested:true});
 const payload=JSON.parse(s.axios.request.mock.calls[0][0].data);
 expect(payload).toMatchObject({modelName:'NEW',model_id:'new',userBroker:'Zerodha',allocationReviewRequested:true});
 expect(s.setCalculatedPortfolioData).toHaveBeenCalledWith(expect.objectContaining({_rebalanceModelName:'NEW',_rebalanceModelId:'new'}));
 expect(s.setOpenRebalanceModal).toHaveBeenCalledWith(true);
});
test('actual parent rechecks broker before calculation and never falls back to DummyBroker',async()=>{
 const s=parentScope();s.refreshBrokerStatus.mockResolvedValue({brokerStatus:'expired',broker:'Zerodha'});
 expect(await s.calculate({directReview:true,modelName:'NEW',modelId:'new'})).toBe('reconnect');
 expect(s.axios.request).not.toHaveBeenCalled();
});
test('actual parent reuses the session the card handed forward (no second probe)',async()=>{
 const s=parentScope();
 await s.calculate({directReview:true,modelName:'NEW',modelId:'new',
  liveSession:{broker:'Zerodha',brokerStatus:'connected',funds:{data:{availablecash:100}}}});
 expect(s.refreshBrokerStatus).not.toHaveBeenCalled();
 expect(s.axios.request).toHaveBeenCalledTimes(1);
});
test('actual parent routes calculate sessionExpired to reconnect',async()=>{
 const s=parentScope();s.axios.request.mockResolvedValue({data:{sessionExpired:true}});
 expect(await s.calculate({directReview:true,modelName:'NEW',modelId:'new',
  liveSession:{broker:'Zerodha',brokerStatus:'connected',funds:{data:{availablecash:100}}}})).toBe('reconnect');
 expect(s.setOpenTokenExpireModel).toHaveBeenCalledWith(true);
});
test('actual parent discards a speculative calculation when the probe shows expiry',async()=>{
 const s=parentScope();
 const r=await s.calculate({directReview:true,modelName:'NEW',modelId:'new',expectedBroker:'Zerodha',
  pendingSession:Promise.resolve({broker:'Zerodha',brokerStatus:'expired'})});
 expect(r).toBe('reconnect');
 expect(s.setOpenTokenExpireModel).toHaveBeenCalledWith(true);
 expect(s.setOpenRebalanceModal).not.toHaveBeenCalled();
});
test('actual parent reports a broker change instead of showing the speculative result',async()=>{
 const s=parentScope();
 const r=await s.calculate({directReview:true,modelName:'NEW',modelId:'new',expectedBroker:'Zerodha',
  pendingSession:Promise.resolve({broker:'Dhan',brokerStatus:'connected',funds:{data:{availablecash:100}}})});
 expect(r).toBe('broker_changed');
 expect(s.setOpenRebalanceModal).not.toHaveBeenCalled();
});
test('actual parent shows a speculative result once the probe confirms the broker',async()=>{
 const s=parentScope();
 await s.calculate({directReview:true,modelName:'NEW',modelId:'new',expectedBroker:'Zerodha',
  pendingSession:Promise.resolve({broker:'Zerodha',brokerStatus:'connected',funds:{data:{availablecash:100}}})});
 expect(s.refreshBrokerStatus).not.toHaveBeenCalled();
 expect(s.setOpenRebalanceModal).toHaveBeenCalledWith(true);
 expect(JSON.parse(s.axios.request.mock.calls[0][0].data).userBroker).toBe('Zerodha');
});
test('actual parent preserves server holdings blocker without opening an execution review',async()=>{
 const s=parentScope();s.axios.request.mockResolvedValue({data:{accountRecovery:{blocked:true,nextAction:{code:'review_holdings'}}}});
 expect(await s.calculate({directReview:true,modelName:'NEW',modelId:'new'})).toBe('review_holdings');
 expect(s.setOpenRebalanceModal).not.toHaveBeenCalled();
});
