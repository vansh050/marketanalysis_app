const money = value => `₹${Number(value || 0).toLocaleString('en-IN')}`;

export const describeCapitalReconciliation = reconciliation => {
  const row = reconciliation || {};
  const classification = row.classification || '';
  if (classification === 'verified_unrealized_loss') {
    return `${money(row.explainedByUnrealizedLoss)} is explained by the current unrealized market loss. It is not a request to replace that loss.`;
  }
  if (classification === 'recorded_underdeployment') {
    return `${money(row.explainedByRecordedUnderdeployment)} was below the historical intent in the last recorded executed budget. Matching broker cash stays unassigned until verified or explicitly added.`;
  }
  if (['loss_and_recorded_underdeployment', 'mixed_unresolved'].includes(classification)) {
    return `${money(row.explainedByUnrealizedLoss)} is explained by unrealized loss, ${money(row.explainedByRecordedUnderdeployment)} by recorded under-deployment, and ${money(row.unresolvedCapitalDifference)} is still unresolved.`;
  }
  if (classification === 'unexplained_difference') {
    return `${money(row.unresolvedCapitalDifference)} cannot yet be proven as loss, model cash, settlement cash, or withdrawal. Other broker cash was not used automatically.`;
  }
  return 'Other broker cash was not used without an explicit instruction or verified model attribution.';
};
