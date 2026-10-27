import { isCode, type TMaybeCode } from '@story/protocol';
import { parseStringLiteral, quoteString } from '../../components/inputs/codeLiterals';

const TRANSLATED_RE = /^_\(\s*([\s\S]*?)\s*\)$/;

// undefined when the name is code that a plain text field cannot round-trip
export const nameAsText = (name: TMaybeCode<string>): string | undefined => {
    if (!isCode(name)) return name;
    const call = TRANSLATED_RE.exec(name.code.trim());
    return call ? parseStringLiteral(call[1]) : undefined;
};

export const withNameText = (name: TMaybeCode<string>, text: string): TMaybeCode<string> =>
    isCode(name) ? { code: `_(${quoteString(text)})` } : text;
