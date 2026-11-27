import { Paper, styled } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { SuggestionList } from '../components/inputs/SuggestionList';
import type { AiSuggestStore } from './AiSuggestStore';

type TProps = {
    suggest: AiSuggestStore;
    id: string;
    optionId: (index: number) => string;
};

export const AiSuggestions = observer(({ suggest, id, optionId }: TProps) => {
    const { open, items, selected, token, loadingPassages, awaitingPassage } = suggest;

    if (!open) return null;
    const notes = [
        ...(loadingPassages ? [_('Loading passages…')] : []),
        ...(awaitingPassage ? [_('…or click a passage in the graph')] : []),
    ];
    return (
        <SPopup elevation={6}>
            <SuggestionList
                id={id}
                ariaLabel={token?.trigger === '/' ? _('Commands') : _('References')}
                items={items}
                selected={selected}
                optionId={optionId}
                onPick={(index) => suggest.accept(index)}
                notes={notes}
            />
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
