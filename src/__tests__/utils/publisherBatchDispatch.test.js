import {createPublisherBatchDispatcher} from '../../utils/publisherBatchDispatch';
const sell={transactionType:'SELL',quantity:4};
const buy={transactionType:'BUY',quantity:8};
test('sells and buys require separate acknowledgements and open once each',async()=>{
 const d=createPublisherBatchDispatcher();const calls=[];
 const run=(index,legs)=>d.run({attemptId:'a',index,legs,authorize:async id=>calls.push('authorize:'+id),open:async()=>calls.push('open:'+index)});
 await run(0,[sell]);await run(1,[buy]);
 expect(calls).toEqual(['authorize:a:SELL:0','open:0','authorize:a:BUY:1','open:1']);
 await expect(run(0,[sell])).rejects.toThrow('already');
});
test('refused buys never open and can be checked again without replaying sells',async()=>{
 const d=createPublisherBatchDispatcher();const open=jest.fn();const authorize=jest.fn().mockRejectedValueOnce(new Error('sell confirmation pending')).mockResolvedValueOnce(true);
 const args={attemptId:'a',index:1,legs:[buy],authorize,open};
 await expect(d.run(args)).rejects.toThrow('sell confirmation');expect(open).not.toHaveBeenCalled();
 await d.run(args);expect(open).toHaveBeenCalledTimes(1);expect(authorize.mock.calls[0][0]).toBe(authorize.mock.calls[1][0]);
});
test('lost callback/open failure never permits another form submission',async()=>{
 const d=createPublisherBatchDispatcher();const authorize=jest.fn();const args={attemptId:'a',index:0,legs:[buy],authorize,open:async()=>{throw new Error('lost callback')}};
 await expect(d.run(args)).rejects.toThrow('lost callback');await expect(d.run(args)).rejects.toThrow('already');expect(authorize).toHaveBeenCalledTimes(1);
});
test('concurrent clicks cannot authorize or open twice',async()=>{
 const d=createPublisherBatchDispatcher();let release;const promise=new Promise(r=>{release=r});const open=jest.fn();const args={attemptId:'a',index:0,legs:[sell],authorize:()=>promise,open};
 const first=d.run(args);await expect(d.run(args)).rejects.toThrow('already');release();await first;expect(open).toHaveBeenCalledTimes(1);
});
// A batch refused after dispatch may already be with the broker; callers must
// be able to tell that apart from a genuine failure, or they report "rejected"
// for orders that exist and invite the retry that double-places.
test('a refusal after dispatch is flagged as an unknown outcome',async()=>{
 const d=createPublisherBatchDispatcher();const args={attemptId:'a',index:0,legs:[sell],authorize:jest.fn(),open:jest.fn()};
 await d.run(args);
 const error=await d.run(args).catch(e=>e);
 expect(error.dispatchUncertain).toBe(true);
});
test('a refusal before dispatch is not an unknown outcome',async()=>{
 const d=createPublisherBatchDispatcher();let release;const promise=new Promise(r=>{release=r});
 const args={attemptId:'a',index:0,legs:[sell],authorize:()=>promise,open:jest.fn()};
 const first=d.run(args);
 const error=await d.run(args).catch(e=>e);
 expect(error.dispatchUncertain).toBeUndefined();
 release();await first;
});
test('a preparation failure stays a failure',async()=>{
 const d=createPublisherBatchDispatcher();
 const error=await d.run({attemptId:'a',index:0,legs:[sell],authorize:async()=>{throw new Error('cash unreadable')},open:jest.fn()}).catch(e=>e);
 expect(error.dispatchUncertain).toBeUndefined();
});
test('mixed sides are rejected before authorization',async()=>{
 const authorize=jest.fn();await expect(createPublisherBatchDispatcher().run({attemptId:'a',index:0,legs:[sell,buy],authorize})).rejects.toThrow('valid order batch');expect(authorize).not.toHaveBeenCalled();
});
