/**
 * Broker connect sheet: when the "I have whitelisted this IP" box is not
 * ticked, tapping the form (fields or Continue/Connect) must take the customer
 * to that box and flash it — the form used to ignore taps silently
 * (pointerEvents="none"). Shared by AlphaPro and every fork (Kyzen).
 */
const fs = require('fs');
const path = require('path');

const read = rel => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
const modal = read('components/BrokerConnectionModal/Phase3SdkBrokerModal.js');
const callout = read('components/BrokerConnectionModal/EgressIpCallout.js');

describe('egress acknowledgment nudge', () => {
  test('the locked form no longer swallows taps', () => {
    expect(modal).not.toMatch(/egressReady && showEgressCallout \? 'none' : 'auto'/);
  });

  test('a tap-catcher over the locked form nudges to the checkbox', () => {
    const overlay = modal.indexOf('testID="egress-ack-lock-overlay"');
    expect(overlay).toBeGreaterThan(-1);
    const block = modal.slice(overlay - 400, overlay + 300);
    expect(block).toContain('!egressReady && showEgressCallout');
    expect(block).toContain('onPress={nudgeEgressAck}');
    expect(block).toContain('style={StyleSheet.absoluteFill}');
  });

  test('the nudge scrolls to the acknowledgment row, falling back to the top', () => {
    expect(modal).toContain('ackAnchorRef={ackAnchorRef}');
    expect(modal).toContain('anchor.measureLayout(');
    expect(modal).toContain('scroll.scrollTo({y: Math.max(0, y - 24), animated: true})');
    expect(modal).toContain('const toTop = () => scroll?.scrollTo({y: 0, animated: true});');
  });

  test('both acknowledgment variants (claimed IP and shared IP) carry the anchor', () => {
    expect(callout.match(/ref=\{ackAnchorRef\}/g)).toHaveLength(2);
    // The flash + "Please tick this box" message still fire on showUnmetAck.
    expect(callout).toContain('Please tick this box to confirm');
  });
});
