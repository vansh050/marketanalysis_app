import { makeLegalWebViewGuard, isSameLegalDocument } from '../../utils/legalWebViewGuard';

describe('legal WebView guard', () => {
  const doc = 'https://kyzenresearch.com/privacy-policy';

  it('treats trailing-slash / scheme / www variants as the same document', () => {
    expect(isSameLegalDocument('https://kyzenresearch.com/privacy-policy/', doc)).toBe(true);
    expect(isSameLegalDocument('http://www.kyzenresearch.com/privacy-policy', doc)).toBe(true);
    expect(isSameLegalDocument('https://kyzenresearch.com/terms', doc)).toBe(false);
  });

  it('allows the redirect that used to close the screen', () => {
    const open = jest.fn();
    const guard = makeLegalWebViewGuard(doc, open);
    expect(guard({ url: 'https://kyzenresearch.com/privacy-policy/', navigationType: 'other' })).toBe(true);
    expect(guard({ url: 'https://cdn.example.com/x', isTopFrame: false })).toBe(true);
    expect(guard({ url: 'https://other.example.com/', navigationType: 'other' })).toBe(true);
    expect(open).not.toHaveBeenCalled();
  });

  it('opens clicked off-document links externally instead of closing', () => {
    const open = jest.fn();
    const guard = makeLegalWebViewGuard(doc, open);
    expect(guard({ url: 'https://other.example.com/', navigationType: 'click' })).toBe(false);
    expect(guard({ url: 'mailto:help@example.com' })).toBe(false);
    expect(open).toHaveBeenCalledTimes(2);
  });
});
