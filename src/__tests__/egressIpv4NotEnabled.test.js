/**
 * Advisors whose dedicated IPv4 is disabled get no whitelist IP: the callout
 * shows "contact your advisor" and Connect stays locked. The shared advisor
 * IP must never be shown on a connect screen — Motilal lets only one user
 * register an IP (Kyzen, 2026-10-26). Shared by AlphaPro and every fork.
 */
const fs = require('fs');
const path = require('path');

const read = rel => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
const callout = read('components/BrokerConnectionModal/EgressIpCallout.js');
const motilal = read('UIComponents/BrokerConnectionUI/MotilalConnectUI.js');

describe('IPv4 not enabled for the advisor', () => {
  test('the callout renders the ipv4_not_enabled state with the server message', () => {
    const i = callout.indexOf("if (brokerState === 'ipv4_not_enabled')");
    expect(i).toBeGreaterThan(-1);
    const block = callout.slice(i, i + 900);
    expect(block).toContain('brokerEntry?.message');
    expect(block).toContain('contact your advisor');
    expect(block).not.toMatch(/IpAddressBox|onAcknowledgeChange\(true\)/);
  });

  test('a 403 ipv4_not_enabled claim refreshes status instead of showing an error', () => {
    expect(callout).toContain("err.response?.data?.error_code === 'ipv4_not_enabled'");
  });

  test('Connect unlocks only for partner / claimed / shared_ip, never ipv4_not_enabled', () => {
    expect(callout).not.toMatch(/brokerState === 'ipv4_not_enabled'[^\n]*onAcknowledgeChange/);
  });

  test('Motilal uses the callout, not a hard-coded shared IP', () => {
    expect(motilal).not.toMatch(/72\.61\.251\.253/);
    expect(motilal).toMatch(/<EgressIpCallout[\s\S]{0,80}broker="motilaloswal"/);
  });
});
