import { Button, styled } from '@mui/material';
import { Row, spacingCss } from '@story/ui';
import { useEngine, useWorldState } from '../context';
import { restartGame } from '../restartGame';

export const SavedGameActions = () => {
    const e = useEngine();
    const s = useWorldState();

    // a save made before the first move has no history to replay
    const continueGame = () =>
        Object.keys(s.currentHistory).length === 0
            ? e.startAs(s.mainCharacterId)
            : e.handleAutoStart();

    return (
        <SRow>
            <Button
                variant="contained"
                color="secondary"
                size="large"
                onClick={() => void continueGame()}
            >
                {_('Continue')}
            </Button>
            <Button
                variant="outlined"
                color="inherit"
                size="large"
                onClick={() => restartGame(e)}
            >
                {_('New game')}
            </Button>
        </SRow>
    );
};

const SRow = styled(Row)`
    flex-wrap: wrap;
    gap: ${spacingCss(2)};

    & > button {
        min-width: 160px;
    }
`;
