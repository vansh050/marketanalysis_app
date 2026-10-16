/**
 * Source-level markers compiled by scripts/babel-plugin-design-literals.js.
 * They intentionally have safe runtime fallbacks for non-Babel tooling.
 *
 * designToken('<surface>.<role>') names a shared host-surface colour/font. The
 * build inlines the active design's value (designs/<variant>/tokens/
 * hostTokens.json over designs/default/tokens/hostTokens.json); the runtime
 * fallback returns the default design's value.
 */
import DEFAULT_HOST_TOKENS from '../../designs/default/tokens/hostTokens.json';

export const designColor = key => `#${key}`;
export const designFont = fontFamily => fontFamily;
// null in the JSON means "unset" -> undefined (never the string "null").
export const designToken = name => DEFAULT_HOST_TOKENS[name] ?? undefined;
