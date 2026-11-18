import { useEffect, useRef } from 'react';
import { ListItemButton, ListItemText, Paper, styled } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { AiSuggestionNote } from './AiSuggestionNote';
import type { AiSuggestStore } from './AiSuggestStore';

type TProps = {
    suggest: AiSuggestStore;
    id: string;
    optionId: (index: number) => string;
};

export const AiSuggestions = observer(({ suggest, id, optionId }: TProps) => {
    const listRef = useRef<HTMLDivElement>(null);
    const { open, items, selected, token, loadingPassages, awaitingPassage } = suggest;

    useEffect(() => {
        if (selected === null) return;
        listRef.current?.querySelector(`[data-index="${selected}"]`)?.scrollIntoView?.({ block: 'nearest' });
    }, [selected]);

    if (!open) return null;
    return (
        <SPopup
            ref={listRef}
            id={id}
            elevation={6}
            role="listbox"
            aria-label={token?.trigger === '/' ? _('Commands') : _('References')}
        >
            {items.map((item, i) => (
                <ListItemButton
                    key={item.key}
                    id={optionId(i)}
                    data-index={i}
                    dense
                    role="option"
                    selected={i === selected}
                    aria-selected={i === selected}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => suggest.accept(i)}
                >
                    <ListItemText primary={<code>{item.label}</code>} secondary={item.detail} />
                </ListItemButton>
            ))}
            {loadingPassages && <AiSuggestionNote text={_('Loading passages…')} />}
            {awaitingPassage && <AiSuggestionNote text={_('…or click a passage in the graph')} />}
        </SPopup>
    );
});

const SPopup = styled(Paper)`
    position: absolute;
    left: 0;
    right: 0;
    bottom: 100%;
    z-index: 1;
    max-height: 240px;
    overflow-y: auto;
`;
