/**
 * Phase3BrokerHelp — per-broker instructional content for
 * Phase3SdkBrokerModal. Renders the same `*HelpContent` components
 * the legacy modals use, so users get the full step-by-step guide,
 * video, and IP-whitelist warnings under the SDK form too.
 *
 * Background: legacy per-broker modals embed rich instructional
 * content (4-8 step guides, broker portal links, video tutorials,
 * IP-whitelist gotchas, broker-specific warnings like Fyers'
 * "Order Placement permission" or Upstox UDAPI1154). Phase 3 was
 * shipping with only `EgressIpCallout` + bare form, leaving users
 * with no guidance — confirmed regression 2026-04-28.
 *
 * Rather than duplicate the help content into the SDK widget schema,
 * we render the existing legacy `*HelpContent.js` components inline
 * in the SDK modal. Single source of truth for help content
 * regardless of legacy vs SDK rendering path.
 *
 * See:
 *   src/UIComponents/BrokerConnectionUI/HelpUI/*HelpContent.js
 *   docs/PHASE3_BROKER_AUDIT.md § Cross-cutting gaps (#3)
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

import HDFCHelpContent from '../../UIComponents/BrokerConnectionUI/HelpUI/HDFCHelpContent';
import FyersHelpContent from '../../UIComponents/BrokerConnectionUI/HelpUI/FyersHelpContent';
import UpstoxHelpContent from '../../UIComponents/BrokerConnectionUI/HelpUI/UpstoxHelpContent';
import MotilalHelpContent from '../../UIComponents/BrokerConnectionUI/HelpUI/MotilalHelpContent';
import AliceblueHelpContent from '../../UIComponents/BrokerConnectionUI/HelpUI/AliceblueHelpContent';
import ZerodhaHelpContent from '../../UIComponents/BrokerConnectionUI/HelpUI/ZerodhaHelpContent';
import GrowwHelpContent from '../../UIComponents/BrokerConnectionUI/HelpUI/GrowwHelpContent';
import KotakHelpContent from '../../UIComponents/BrokerConnectionUI/HelpUI/KotakHelpContent';
import DhanHelpContent from '../../UIComponents/BrokerConnectionUI/HelpUI/DhanHelpContent';
import ICICIHelpContent from '../../UIComponents/BrokerConnectionUI/HelpUI/ICICIHelpContent';

// Map normalized broker key (from BrokerConnectModalDispatch.normalizeBrokerKey)
// → matching legacy *HelpContent component. Brokers without help
// content (Axis, IIFL, Angel One — their legacy modals don't have
// dedicated help components either) render null and just show the
// SDK form below.
// Brokers where legacy modal renders inline help (video + step guide).
// Phase 3 SDK modal renders the same help via this dispatch.
//
// AliceBlue, Dhan, Axis Securities deliberately omitted — their
// legacy modals open the WebView immediately with no inline help
// (partner-OAuth flows where the broker's own portal handles user
// guidance). Including them here introduced a friction step the
// legacy never had — user reported 2026-04-29 "instructions etc not
// relevant here as its not needed" for AliceBlue.
const HELP_BY_BROKER = {
  HDFC: HDFCHelpContent,
  'Hdfc Securities': HDFCHelpContent,
  Fyers: FyersHelpContent,
  Upstox: UpstoxHelpContent,
  Motilal: MotilalHelpContent,
  'Motilal Oswal': MotilalHelpContent,
  Zerodha: ZerodhaHelpContent,
  Groww: GrowwHelpContent,
  Kotak: KotakHelpContent,
  ICICI: ICICIHelpContent,
  'ICICI Direct': ICICIHelpContent,
};

const Phase3BrokerHelp = ({ brokerName }) => {
  // Default expanded ON — first-time SDK users have NEVER seen any
  // step guide before, so showing collapsed defeats the purpose of
  // wiring this in. Legacy modals default collapsed because the
  // legacy form itself has inline copy-text adjacent to each input;
  // SDK form has none, so we lean into the help being visible.
  const [expanded, setExpanded] = useState(true);

  const HelpComponent = HELP_BY_BROKER[brokerName];
  if (!HelpComponent) return null;

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        style={styles.toggle}
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={expanded ? 'Hide help' : 'Show help'}>
        <Text style={styles.toggleLabel}>
          {expanded ? '▾ Hide help' : '▸ Show help'}
        </Text>
      </TouchableOpacity>
      {expanded ? (
        <View style={styles.helpBody}>
          <HelpComponent expanded={expanded} onExpandChange={() => {}} />
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  toggle: {
    paddingVertical: 8,
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563EB',
  },
  helpBody: {
    marginTop: 4,
  },
});

export default Phase3BrokerHelp;
