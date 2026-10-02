import fs from 'fs';
import path from 'path';
import {parse} from '@babel/parser';
import {createPublisherBatchDispatcher} from '../../utils/publisherBatchDispatch';

const files = ['AdviceScreenComponents/RebalanceModal.js', 'ModelPortfolioComponents/MPReviewTradeModal.js'];
const findSubmit = node => {
  if (!node || typeof node !== 'object') return null;
  if (node.type === 'VariableDeclarator' && node.id?.name === 'submitKiteBatch') return node.init;
  for (const value of Object.values(node)) {
    for (const child of Array.isArray(value) ? value : [value]) {
      const found = findSubmit(child);
      if (found) return found;
    }
  }
  return null;
};

test.each(files)('%s advances only after exact BUY permission and never reopens a batch', async file => {
  const source = fs.readFileSync(path.resolve(__dirname, '../../components', file), 'utf8');
  const node = findSubmit(parse(source, {sourceType:'module', plugins:['jsx']}));
  const sells = [{transactionType:'SELL', quantity:2}];
  const buys = [{transactionType:'BUY', quantity:3}];
  const full = [...sells, ...buys];
  const open = jest.fn();
  const record = jest.fn().mockRejectedValueOnce(new Error('SELL not yet verified')).mockResolvedValue(true);
  const index = {current:0};
  const poll = jest.fn().mockResolvedValue(undefined);
  const scope = {
    pendingKiteBatchesRef:{current:[sells,buys]}, currentKiteBatchIndexRef:index,
    publisherAttemptRef:{current:{attemptId:'attempt'}}, publisherFullLegsRef:{current:full},
    publisherBatchDispatcherRef:{current:createPublisherBatchDispatcher()},
    recordPublisherIntent:record, buildKiteBasket:legs=>legs,
    fetchFreshKiteProtectionPrices:jest.fn().mockResolvedValue({}), symbolMap:{},
    refittedKiteBatchesRef:{current:new Set()}, refitPendingBatchRef:{current:jest.fn().mockResolvedValue(true)},
    finishKitePublisherRun:jest.fn(), Toast:{show:jest.fn()},
    generateHtmlForm:()=>'<form />', zerodhaApiKey:'test',
    startOrderPolling:poll, startKitePolling:poll,
    setHtmlContent:jest.fn(), setWebView:open, setLoading:jest.fn(), stopOrderPolling:jest.fn(),
  };
  const submit = new Function('scope', `with(scope){return (${source.slice(node.start,node.end)});}`)(scope);
  await expect(submit(1)).rejects.toThrow('SELL not yet verified');
  expect(index.current).toBe(0);
  expect(open).not.toHaveBeenCalled();
  if (file.startsWith('AdviceScreenComponents')) {
    expect(poll).toHaveBeenCalledWith({expectedOrderCount: buys.length});
  } else {
    expect(poll).not.toHaveBeenCalled();
  }
  await submit(1);
  expect(record).toHaveBeenLastCalledWith(full, {attemptId:'attempt'}, buys, 'attempt:BUY:1');
  expect(index.current).toBe(1);
  expect(open).toHaveBeenCalledTimes(1);
  await expect(submit(1)).rejects.toThrow('already');
  expect(open).toHaveBeenCalledTimes(1);
});
