import { observer } from 'mobx-react-lite';
import { Button, styled } from '@mui/material';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import { spacingCss } from '@story/ui';
import { TooltipIconButton } from '../../components/buttons/TooltipIconButton';
import { FormSection } from '../../components/form/FormSection';
import { EmptyState } from '../../components/feedback/EmptyState';
import type { ChapterGraphStore } from './ChapterGraphStore';
import { confirmRemoveCharacter, openAddCharacter } from './dialogs';
import { characterColor } from './graph/colors';

type TProps = {
    store: ChapterGraphStore;
};

export const ChapterCharacters = observer(({ store }: TProps) => (
    <FormSection title={_('Characters')}>
        {store.chapterCharacters.length === 0 ? (
            <EmptyState
                message={_('No character has passages in this chapter yet.')}
                action={
                    <Button
                        size="small"
                        onClick={() => openAddCharacter(store)}
                    >
                        {_('Add character')}
                    </Button>
                }
            />
        ) : (
            <SCharacters>
                {store.chapterCharacters.map((c) => (
                    <SCharacter key={c.id}>
                        <SSwatch
                            style={{ borderColor: characterColor(c.id) }}
                        />
                        <span>
                            {c.name} —{' '}
                            {c.passageCount === 1
                                ? _('1 passage')
                                : _('%d passages', c.passageCount)}
                        </span>
                        <TooltipIconButton
                            title={_('Remove %s from this chapter', c.name)}
                            icon={PersonRemoveIcon}
                            onClick={() =>
                                void confirmRemoveCharacter(store, c.id)
                            }
                        />
                    </SCharacter>
                ))}
            </SCharacters>
        )}
    </FormSection>
));

const SCharacters = styled('div')`
    display: flex;
    flex-direction: column;
    gap: ${spacingCss(0.5)};
`;

const SCharacter = styled('div')`
    display: flex;
    align-items: center;
    gap: ${spacingCss(1)};
    font-size: ${({ theme }) => theme.typography.body2.fontSize};
`;

const SSwatch = styled('span')`
    display: inline-block;
    width: ${spacingCss(1.75)};
    height: ${spacingCss(1.75)};
    border: 2px solid;
    border-radius: 3px;
`;
