import { useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import styled from '@emotion/styled';
import { IconButton, TextField, Tooltip } from '@mui/material';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import { Row, spacingCss } from '@story/ui';
import type { MapPageStore } from './MapPageStore';
import { nameAsText } from './locationName';

type Props = {
    store: MapPageStore;
    locationId: string;
    onEditInForm: (locationId: string) => void;
};

export const LocationNameEditor = observer(
    ({ store, locationId, onEditInForm }: Props) => {
        const [draft, setDraft] = useState<string | null>(null);
        const inputRef = useRef<HTMLInputElement>(null);
        const cancelled = useRef(false);
        const location = store.locations.get(locationId);
        const name = store.locationName(locationId);

        const startEditing = () => {
            const text = location ? nameAsText(location.name) : undefined;
            if (text === undefined) onEditInForm(locationId);
            else setDraft(text);
        };
        const commit = () => {
            if (draft === null) return;
            setDraft(null);
            if (cancelled.current) {
                cancelled.current = false;
                return;
            }
            const text = draft.trim();
            if (text) void store.renameLocation(locationId, text);
        };

        if (draft !== null) {
            return (
                <TextField
                    size="small"
                    fullWidth
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    inputRef={inputRef}
                    onBlur={commit}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') inputRef.current?.blur();
                        if (e.key === 'Escape') {
                            e.stopPropagation();
                            cancelled.current = true;
                            inputRef.current?.blur();
                        }
                    }}
                    slotProps={{
                        htmlInput: { 'aria-label': _('Location name') },
                    }}
                />
            );
        }

        return (
            <SRow>
                <SName title={name}>{name}</SName>
                {location && (
                    <Tooltip title={_('Rename')}>
                        <IconButton
                            size="small"
                            color="inherit"
                            onClick={startEditing}
                            aria-label={_('Rename')}
                        >
                            <EditRoundedIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                )}
            </SRow>
        );
    }
);

const SRow = styled(Row)`
    flex: 1;
    min-width: 0;
    align-items: center;
    gap: ${spacingCss(0.25)};
`;

const SName = styled.span`
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 15px;
    font-weight: 600;
`;
