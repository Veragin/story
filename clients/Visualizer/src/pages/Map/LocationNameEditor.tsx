import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { styled } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import { spacingCss } from '@story/ui';
import { TooltipIconButton } from '../../components/buttons/TooltipIconButton';
import { TextInput } from '../../components/inputs/TextInput';
import type { MapPageStore } from './MapPageStore';
import { nameAsText } from './locationName';

type TProps = {
    store: MapPageStore;
    locationId: string;
    onEditInForm: (locationId: string) => void;
};

export const LocationNameEditor = observer(
    ({ store, locationId, onEditInForm }: TProps) => {
        const [draft, setDraft] = useState<string | null>(null);
        const draftRef = useRef<string | null>(null);
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
                <TextInput
                    ariaLabel={_('Location name')}
                    autoFocus
                    value={draft}
                    onChange={updateDraft}
                    onBlur={commit}
                    onEnter={commit}
                    onEscape={() => updateDraft(null)}
                />
            );
        }

        return (
            <SRow>
                <SName title={name}>{name}</SName>
                {location && (
                    <TooltipIconButton
                        title={_('Rename')}
                        icon={EditIcon}
                        tone="inherit"
                        onClick={startEditing}
                    />
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

const SRow = styled('div')`
    display: flex;
    flex: 1;
    min-width: 0;
    align-items: center;
    gap: ${spacingCss(0.25)};
`;

const SName = styled('span')`
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: ${({ theme }) => theme.typography.subtitle1.fontSize};
    font-weight: 600;
`;
