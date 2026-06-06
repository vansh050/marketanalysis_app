/**
 * Pill — design-system primitive (badge / status tag)
 *
 * Variants:
 *   - neutral  surface.muted bg + text.muted fg
 *   - profit   pnl.profitBg + pnl.profit fg (BUY badges, P&L positive)
 *   - loss     pnl.lossBg + pnl.loss fg (SELL badges, P&L negative)
 *   - warning  status.warningBg + status.warning fg
 *
 * Auto-sized to content via `alignSelf: 'flex-start'`; pass
 * `style={{ alignSelf: 'auto' }}` if you want the parent's alignment.
 */

import React, { useMemo } from 'react';
import { View } from 'react-native';
import useTokens from '../../../src/theme/useTokens';
import Text from './Text';

const buildVariantStyles = (tokens) => ({
    neutral: { bg: tokens.colors.surface.muted, fg: tokens.colors.text.muted },
    profit: { bg: tokens.colors.pnl.profitBg, fg: tokens.colors.pnl.profit },
    loss: { bg: tokens.colors.pnl.lossBg, fg: tokens.colors.pnl.loss },
    warning: { bg: tokens.colors.status.warningBg, fg: tokens.colors.status.warning },
});

const Pill = ({ variant = 'neutral', label, style, labelStyle, ...rest }) => {
    const tokens = useTokens();
    const variants = useMemo(() => buildVariantStyles(tokens), [tokens]);
    const v = variants[variant] || variants.neutral;

    return (
        <View
            style={[
                {
                    backgroundColor: v.bg,
                    paddingHorizontal: tokens.spacing.sm,
                    paddingVertical: 2,
                    borderRadius: tokens.radii.sm,
                    alignSelf: 'flex-start',
                },
                style,
            ]}
            {...rest}
        >
            <Text variant="caption" style={[{ color: v.fg }, labelStyle]}>
                {label}
            </Text>
        </View>
    );
};

export default Pill;
