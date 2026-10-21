// Player-chosen names (drivers, builds) are shown to other players, so they
// may not hold control characters, invisible formatting characters or line
// breaks.
export const BAD_NAME_CHARS = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;

export const hasBadNameChars = (s) => BAD_NAME_CHARS.test(s);

/** Drop disallowed characters (for names that come from elsewhere, like Google). */
export const stripBadNameChars = (s) => s.replace(new RegExp(BAD_NAME_CHARS.source, 'gu'), '');
