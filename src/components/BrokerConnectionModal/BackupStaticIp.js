/**
 * BackupStaticIp — Manage Connections prompt for the customer's SECOND
 * whitelisted IP (OVH Mumbai) on one connected broker. Renders nothing unless
 * /egress/me returns a second IP for that broker (feature off, partner or
 * IPv4-only brokers → nothing). Presentation and the "I've added it" call
 * live in EgressIpCallout.js (SecondStaticIp) so both screens stay identical.
 * Web twin: prod-alphaquark-github src/Home/BrokerConnection/BackupStaticIp.js.
 */
import React, {useEffect, useState} from 'react';
import {SecondStaticIp, fetchEgressEntry} from './EgressIpCallout';

// connected_brokers[].broker → egress broker key (whitelisted IPv6 brokers).
export const EGRESS_BROKER_KEY_BY_NAME = {
  Upstox: 'upstox',
  'ICICI Direct': 'icicidirect',
  'IIFL Securities': 'iifl',
  Fyers: 'fyers',
  Groww: 'groww',
  'DefinEdge Securities': 'definedge',
  'Hdfc Securities': 'hdfcsec',
};

const BackupStaticIp = ({broker, customerId, customerEmail, configData}) => {
  const brokerKey = EGRESS_BROKER_KEY_BY_NAME[broker] || null;
  const [entry, setEntry] = useState(null);

  useEffect(() => {
    let alive = true;
    if (brokerKey) {
      fetchEgressEntry({brokerKey, customerId, customerEmail, configData}).then(e => {
        if (alive) {
          setEntry(e);
        }
      });
    }
    return () => {
      alive = false;
    };
  }, [brokerKey, customerId, customerEmail, configData]);

  if (!entry?.ovh_address || entry.status !== 'claimed') {
    return null;
  }
  return (
    <SecondStaticIp
      brokerKey={brokerKey}
      entry={entry}
      customerId={customerId}
      customerEmail={customerEmail}
      configData={configData}
      onEntryChange={setEntry}
      withCard
    />
  );
};

export default BackupStaticIp;
