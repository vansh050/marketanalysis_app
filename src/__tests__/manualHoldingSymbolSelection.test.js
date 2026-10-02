const fs = require('fs');
const path = require('path');

describe('manual holding symbol selection', () => {
  test('does not persist arbitrary typed symbol text', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../components/AdviceScreenComponents/MPStatusModal.js'),
      'utf8',
    );
    expect(source).toContain('const [selectedInstrument, setSelectedInstrument] = useState(null)');
    expect(source).toContain("selectedInstrument?.symbol?.trim().toUpperCase() || ''");
    expect(source).toContain("selectedInstrument?.exchange?.trim().toUpperCase() || ''");
    expect(source).toContain('!selectedInstrument');
    expect(source).toContain('setSelectedInstrument({');
    expect(source).not.toContain('(newSelectSymbol || newSymbol).trim().toUpperCase()');
  });

  test('normalizes numeric LTP values when selecting a dropdown result', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../components/AdviceScreenComponents/MPStatusModal.js'),
      'utf8',
    );
    expect(source).toContain('const livePrice = cleanPriceInput(ltp);');
    expect(source).toContain('const normalizedPrice = cleanPriceInput(ltpValue);');
    expect(source).not.toContain("ltp.replace(/[₹,]/g, '')");
    expect(source).not.toContain('ltpValue.replace(');
  });
});
