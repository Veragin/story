import { observer } from 'mobx-react-lite';
import {
    Alert,
    Button,
    IconButton,
    styled,
    Tooltip,
    Typography,
} from '@mui/material';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import type { ChapterGraphStore } from './ChapterGraphStore';
import { confirmRemoveCharacter, openAddCharacter } from './dialogs';
import { characterColor } from './graph/colors';

export const ChapterOverview = observer(
    ({ store }: { store: ChapterGraphStore }) => (
        <SOverview>
            <Typography variant="h6">{store.chapterTitle}</Typography>
            <Typography variant="caption" color="text.secondary">
                {store.chapter?.file}
            </Typography>
            <Typography variant="subtitle2" sx={{ mt: 1 }}>
                {_('Characters')}
            </Typography>
            {store.chapterCharacters.length === 0 ? (
                <Alert
                    severity="info"
                    action={
                        <Button
                            color="inherit"
                            size="small"
                            onClick={() => openAddCharacter(store)}
                        >
                            {_('Add character')}
                        </Button>
                    }
                >
                    {_('No character has passages in this chapter yet.')}
                </Alert>
            ) : (
                store.chapterCharacters.map((c) => (
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
                        <Tooltip
                            title={_('Remove %s from this chapter', c.name)}
                        >
                            <IconButton
                                size="small"
                                aria-label={_('Remove character')}
                                onClick={() =>
                                    void confirmRemoveCharacter(store, c.id)
                                }
                            >
                                <PersonRemoveIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </SCharacter>
                ))
            )}
            <Typography variant="subtitle2" sx={{ mt: 1 }}>
                {_('How to')}
            </Typography>
            <SHelp>
                <li>
                    {_(
                        'Drag a box to move it; positions are saved to the chapter layout file.'
                    )}
                </li>
                <li>
                    {_(
                        'Double-click a box (or select it and press Enter) to edit the passage.'
                    )}
                </li>
                <li>
                    {_(
                        'Delete removes the selected passage (after a confirmation).'
                    )}
                </li>
                <li>
                    {_(
                        'Drag the background, or use WASD / arrows, to move; scroll to zoom.'
                    )}
                </li>
                <li>
                    {_(
                        'Dashed arrows are conditional links; red ones point to passages that do not exist.'
                    )}
                </li>
            </SHelp>
        </SOverview>
    )
);

const SOverview = styled('div')`
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px;
`;

const SCharacter = styled('div')`
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
`;

const SSwatch = styled('span')`
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid;
    border-radius: 3px;
`;

const SHelp = styled('ul')`
    margin: 0;
    padding-left: 18px;
    font-size: 13px;
    opacity: 0.8;
`;
