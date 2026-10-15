import { isCode, type TLocalCharacterDto, type TLocationDto, type TMaybeCode } from '@story/visualizer-protocol';

export type TTextDraft =
    | { kind: 'text'; text: string }
    | { kind: 'translated'; text: string }
    | { kind: 'code'; code: string };

export type TLocalCharacterRow = { key: number; name: TTextDraft; description: TTextDraft };

export type TLocationDraft = {
    name: TTextDraft;
    description: TTextDraft;
    localCharacters: { kind: 'list'; rows: TLocalCharacterRow[] } | { kind: 'code'; code: string };
};

export type TLocationPatch = Partial<Pick<TLocationDto, 'name' | 'description' | 'localCharacters'>>;

const TRANSLATED_RE = /^_\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1\s*\)$/s;

const unescape = (s: string) => s.replace(/\\(.)/gs, (_m, c: string) => (c === 'n' ? '\n' : c === 't' ? '\t' : c));

const escapeSingle = (s: string) =>
    s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\t/g, '\\t');

export const toTextDraft = (value: TMaybeCode<string> | undefined): TTextDraft => {
    if (value === undefined) return { kind: 'text', text: '' };
    if (typeof value === 'string') return { kind: 'text', text: value };
    if (isCode(value)) {
        const m = TRANSLATED_RE.exec(value.code.trim());
        if (m && !(m[1] === '`' && m[2].includes('${'))) return { kind: 'translated', text: unescape(m[2]) };
        return { kind: 'code', code: value.code };
    }
    return { kind: 'code', code: JSON.stringify(value) };
};

export const fromTextDraft = (draft: TTextDraft): TMaybeCode<string> => {
    if (draft.kind === 'text') return draft.text;
    if (draft.kind === 'translated') return { code: `_('${escapeSingle(draft.text)}')` };
    return { code: draft.code };
};

let rowKey = 1;
export const newLocalCharacterRow = (): TLocalCharacterRow => ({
    key: rowKey++,
    name: { kind: 'text', text: '' },
    description: { kind: 'text', text: '' },
});

export const toLocationDraft = (dto: TLocationDto): TLocationDraft => ({
    name: toTextDraft(dto.name),
    description: toTextDraft(dto.description),
    localCharacters: isCode(dto.localCharacters)
        ? { kind: 'code', code: dto.localCharacters.code }
        : {
              kind: 'list',
              rows: (dto.localCharacters ?? []).map((c) => ({
                  key: rowKey++,
                  name: toTextDraft(c.name),
                  description: toTextDraft(c.description),
              })),
          },
});

const fromDraftCharacters = (d: TLocationDraft['localCharacters']): TLocationDto['localCharacters'] =>
    d.kind === 'code'
        ? { code: d.code }
        : d.rows.map(
              (r): TLocalCharacterDto => ({ name: fromTextDraft(r.name), description: fromTextDraft(r.description) })
          );

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export const locationPatch = (dto: TLocationDto, draft: TLocationDraft): TLocationPatch => {
    const patch: TLocationPatch = {};
    const name = fromTextDraft(draft.name);
    const description = fromTextDraft(draft.description);
    const localCharacters = fromDraftCharacters(draft.localCharacters);
    if (!same(name, dto.name)) patch.name = name;
    if (!same(description, dto.description ?? '')) patch.description = description;
    if (!same(localCharacters, dto.localCharacters ?? [])) patch.localCharacters = localCharacters;
    return patch;
};
