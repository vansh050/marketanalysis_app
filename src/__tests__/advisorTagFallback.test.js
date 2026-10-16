/**
 * getConfigData guarantees an advisor tag. ~30 call sites send
 * configData.config.REACT_APP_ADVISOR_SPECIFIC_TAG as the `advisor` of ccxt
 * requests; a fork whose env omitted the tag sent none, and
 * /rebalance/calculate answered 400 "advisor is missing" (Kyzen 2026-10-13:
 * Accept rebalance stuck on "Checking broker...").
 */
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../utils/storageUtils.js'), 'utf8');

test('advisor tag falls back to the env tag, then the tenant name', () => {
  expect(src).toMatch(
    /REACT_APP_ADVISOR_SPECIFIC_TAG:\s*parsedConfig\?\.config\?\.REACT_APP_ADVISOR_SPECIFIC_TAG \|\|\s*Config\.REACT_APP_ADVISOR_SPECIFIC_TAG \|\|\s*parsedConfig\?\.config\?\.REACT_APP_HEADER_NAME \|\|\s*Config\.REACT_APP_HEADER_NAME,/,
  );
});
