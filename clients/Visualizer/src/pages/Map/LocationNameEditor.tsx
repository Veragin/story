import { useEffect, useRef, useState } from 'react';
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
        const draftRef = useRef<string | null>(null);
        const inputRef = useRef<HTMLInputElement>(null);
        const location = store.locations.get(locationId);
        const name = store.locationName(locationId);

        const updateDraft = (value: string | null) => {
            draftRef.current = value;
            setDraft(value);
        };
        const startEditing = () => {
            const text = location ? nameAsText(location.name) : undefined;
            if (text === undefined) onEditInForm(locationId);
            else updateDraft(text);
        };
        const commit = () => {
            flushDraft(store, locationId, draftRef);
            setDraft(null);
        };

        // React skips onBlur on unmount, so a pending rename is saved for the id it was started on
        useEffect(
            () => () => flushDraft(store, locationId, draftRef),
            [store, locationId]
        );

        if (draft !== null) {
            return (
                <TextField
                    size="small"
                    fullWidth
                    autoFocus
                    value={draft}
                    onChange={(e) => updateDraft(e.target.value)}
                    inputRef={inputRef}
                    onBlur={commit}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') inputRef.current?.blur();
                        if (e.key === 'Escape') {
                            e.stopPropagation();
                            updateDraft(null);
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

const flushDraft = (
    store: MapPageStore,
    locationId: string,
    draftRef: { current: string | null }
) => {
    const text = draftRef.current?.trim();
    draftRef.current = null;
    if (text) void store.renameLocation(locationId, text);
};

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
