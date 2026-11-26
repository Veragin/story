import {
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    type KeyboardEvent,
} from 'react';
import { Paper, Popper, styled, TextField } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { IMAGE_LINK_PREFIX, imageLinkPath, relativePath } from '@story/shared';
import type { TStoryImageFile } from '../../api';
import {
    mentionSuggestions,
    type TMentionResult,
    type TMentionStores,
} from '../../ai/aiMentions';
import {
    PASSAGE_SUGGESTION_LIMIT,
    SUGGESTION_LIMIT,
} from '../../ai/AiSuggestStore';
import { findActiveToken, replaceToken } from '../../ai/aiToken';
import { INPUT_DEFAULTS } from '../inputs/inputDefaults';
import { useBulletList } from '../inputs/useBulletList';
import { inputSlotProps } from '../inputs/inputSlotProps';
import type { TInputProps } from '../inputs/inputTypes';
import {
    SuggestionList,
    type TSuggestionListItem,
} from '../inputs/SuggestionList';

type TProps = TInputProps<string> & {
    mentions: TMentionStores;
    // with `fromDir`, a description starting with `@` may link one of `files`, relative to it
    files?: readonly TStoryImageFile[];
    fromDir?: string;
    placeholder?: string;
};

type THint = TSuggestionListItem & {
    value: string;
    continues: boolean;
    link: boolean;
};

const NO_MENTION: TMentionResult = { mentionClass: null, matches: [] };

const pathHints = (
    files: readonly TStoryImageFile[],
    fromDir: string,
    before: string
): THint[] => {
    const query = imageLinkPath(before)?.toLowerCase();
    if (query === undefined) return [];
    return files
        .map(({ file, url }) => ({ path: relativePath(fromDir, file), url }))
        .filter(({ path }) => path.toLowerCase().includes(query))
        .map(({ path, url }) => {
            const link = `${IMAGE_LINK_PREFIX}${path}`;
            return {
                key: link,
                label: link,
                thumbnail: url,
                value: link,
                continues: false,
                link: true,
            };
        });
};

export const ImageDescriptionInput = observer(
    ({
        value,
        onChange,
        mentions,
        files = [],
        fromDir,
        placeholder,
        hasError,
        disabled,
        ariaLabel,
        dataField,
    }: TProps) => {
        const field = useRef<HTMLDivElement>(null);
        const input = useRef<HTMLTextAreaElement>(null);
        const pendingCaret = useRef<number | null>(null);
        const [caret, setCaret] = useState<number | null>(null);
        const [focused, setFocused] = useState(false);
        const [dismissed, setDismissed] = useState(false);
        const [highlighted, setHighlighted] = useState(0);
        const [mentioned, setMentioned] = useState(false);

        const before = value.slice(0, caret ?? value.length);
        const found = findActiveToken(before);
        const token = found?.trigger === '@' ? found : null;
        const { passages } = mentions;
        const mention = token
            ? mentionSuggestions(token.query, {
                  project: mentions.entities.project,
                  passages: passages.passages,
              })
            : NO_MENTION;
        const wantsPassages = mention.mentionClass === 'passage';
        const limit =
            wantsPassages && !passages.inChapter
                ? PASSAGE_SUGGESTION_LIMIT
                : SUGGESTION_LIMIT;
        const hints: THint[] = [
            ...mention.matches
                .slice(0, limit)
                .map(({ key, label, detail, value: v, continues }) => ({
                    key,
                    label,
                    detail,
                    value: v,
                    continues,
                    link: false,
                })),
            ...(token?.start === 0 && fromDir !== undefined
                ? pathHints(files, fromDir, before)
                : []),
        ];
        const loadingPassages = wantsPassages && passages.loading;
        const exact =
            hints.length === 1 &&
            !hints[0].continues &&
            token !== null &&
            hints[0].value === before.slice(token.start);
        const open =
            focused &&
            !dismissed &&
            !exact &&
            (hints.length > 0 || loadingPassages);
        const active = Math.max(0, Math.min(highlighted, hints.length - 1));

        if (token && !mentioned) setMentioned(true);

        useEffect(
            () => (mentioned ? mentions.entities.start() : undefined),
            [mentioned, mentions.entities]
        );

        useEffect(() => {
            if (wantsPassages) passages.load();
        }, [wantsPassages, passages]);

        useLayoutEffect(() => {
            if (pendingCaret.current === null || !input.current) return;
            input.current.setSelectionRange(
                pendingCaret.current,
                pendingCaret.current
            );
            pendingCaret.current = null;
        });

        const moveCaret = (at: number) => {
            pendingCaret.current = at;
            setCaret(at);
        };

        const pick = (hint: THint) => {
            setHighlighted(0);
            if (hint.link) {
                onChange(hint.value);
                moveCaret(hint.value.length);
                setDismissed(true);
                return;
            }
            if (!token) return;
            const after = value.slice(before.length);
            const spacer = hint.continues || /^\s/.test(after) ? '' : ' ';
            const head = replaceToken(before, token, hint.value + spacer);
            onChange(head + after);
            moveCaret(head.length);
            setDismissed(!hint.continues);
        };

        const onBulletKey = useBulletList(onChange);

        const onHintKey = (e: KeyboardEvent) => {
            if (!open || hints.length === 0) return;
            const move = (by: number) => {
                e.preventDefault();
                setHighlighted((active + by + hints.length) % hints.length);
            };
            if (e.key === 'ArrowDown') move(1);
            else if (e.key === 'ArrowUp') move(-1);
            else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                pick(hints[active]);
            } else if (e.key === 'Escape') {
                // the hints consume Escape, so an enclosing dialog stays open
                e.stopPropagation();
                setDismissed(true);
            }
        };

        const onKeyDown = (e: KeyboardEvent) => {
            onHintKey(e);
            onBulletKey(e);
        };

        return (
            <>
                <TextField
                    {...INPUT_DEFAULTS}
                    ref={field}
                    inputRef={input}
                    multiline
                    minRows={2}
                    value={value}
                    error={hasError}
                    disabled={disabled}
                    placeholder={placeholder}
                    slotProps={inputSlotProps(
                        { ariaLabel, dataField },
                        {
                            'aria-autocomplete': 'list',
                            'aria-expanded': open,
                            'onSelect': (e) =>
                                setCaret(e.currentTarget.selectionStart),
                        }
                    )}
                    onChange={(e) => {
                        onChange(e.target.value);
                        setCaret(e.target.selectionStart);
                        setDismissed(false);
                        setHighlighted(0);
                    }}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    onKeyDown={onKeyDown}
                />
                <SPopper
                    open={open}
                    anchorEl={field.current}
                    placement="bottom-start"
                    style={{ width: field.current?.clientWidth }}
                >
                    <SPaper elevation={8}>
                        <SuggestionList
                            ariaLabel={_('Suggestions')}
                            items={hints}
                            selected={active}
                            onPick={(index) => pick(hints[index])}
                            notes={
                                loadingPassages ? [_('Loading passages…')] : []
                            }
                        />
                    </SPaper>
                </SPopper>
            </>
        );
    }
);

const SPopper = styled(Popper)`
    z-index: ${({ theme }) => theme.zIndex.modal + 1};
`;

const SPaper = styled(Paper)`
    max-height: 320px;
    overflow: auto;
`;
