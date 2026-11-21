import { useEffect, useRef } from 'react';
import { ListItem, ListItemButton, ListItemText, styled } from '@mui/material';
import { spacingCss } from '@story/ui';

export type TSuggestionListItem = {
    key: string;
    label: string;
    detail?: string;
    thumbnail?: string;
};

type TProps = {
    items: readonly TSuggestionListItem[];
    selected: number | null;
    onPick: (index: number) => void;
    id?: string;
    ariaLabel: string;
    optionId?: (index: number) => string;
    notes?: readonly string[];
};

export const SuggestionList = ({
    items,
    selected,
    onPick,
    id,
    ariaLabel,
    optionId,
    notes = [],
}: TProps) => {
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (selected === null) return;
        listRef.current
            ?.querySelector(`[data-index="${selected}"]`)
            ?.scrollIntoView?.({ block: 'nearest' });
    }, [selected]);

    return (
        <div ref={listRef} id={id} role="listbox" aria-label={ariaLabel}>
            {items.map((item, i) => (
                <SOption
                    key={item.key}
                    id={optionId?.(i)}
                    data-index={i}
                    data-option={item.key}
                    dense
                    role="option"
                    selected={i === selected}
                    aria-selected={i === selected}
                    // keeps the focus in the input, so it does not blur and close the list
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onPick(i)}
                >
                    {item.thumbnail !== undefined && (
                        <SThumb src={item.thumbnail} alt="" />
                    )}
                    <SText
                        primary={<code>{item.label}</code>}
                        secondary={item.detail}
                    />
                </SOption>
            ))}
            {notes.map((note) => (
                <ListItem key={note} dense role="presentation">
                    <ListItemText secondary={note} />
                </ListItem>
            ))}
        </div>
    );
};

const SOption = styled(ListItemButton)`
    gap: ${spacingCss(1)};
`;

const SText = styled(ListItemText)`
    overflow-wrap: anywhere;
`;

const SThumb = styled('img')`
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    object-fit: cover;
    border-radius: 2px;
`;
