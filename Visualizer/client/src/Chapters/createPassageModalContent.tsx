import { Button, styled, Tooltip } from '@mui/material';
import { Column, Modal, Row, spacingCss, Text } from '@story/ui';
import { useVisualizerStore } from '../context';
import { ReactNode, useState } from 'react';
import type { TPassageDto } from '@story/visualizer-protocol';
import OpenInBrowserIcon from '@mui/icons-material/OpenInBrowser';
import DeleteIcon from '@mui/icons-material/Delete';

export const createPassageModalContent = (passage: TPassageDto): ReactNode => (
    <PassageModalContent passage={passage} />
);

const PassageModalContent = ({ passage }: { passage: TPassageDto }) => {
    const [open, setOpen] = useState(false);
    const store = useVisualizerStore();
    const { passageId } = passage;
    return (
        <SColumn>
            <Tooltip title={_('Copy to clipboard')} placement="top">
                <SText
                    onClick={() =>
                        void navigator.clipboard.writeText(passageId)
                    }
                >
                    {passageId}
                </SText>
            </Tooltip>
            <SRow>
                <Tooltip title={_('Open in VS code')}>
                    <Button
                        variant="outlined"
                        color="inherit"
                        onClick={() => void store.agent.openPassage(passageId)}
                    >
                        <OpenInBrowserIcon />
                    </Button>
                </Tooltip>
                <Tooltip title={_('Delete passage')}>
                    <Button
                        color="error"
                        variant="outlined"
                        onClick={() => setOpen(true)}
                    >
                        <DeleteIcon />
                    </Button>
                </Tooltip>
            </SRow>
            <Modal
                title={_('Delete passage %s', passageId)}
                open={open}
                onClose={() => setOpen(false)}
            >
                <SColumn>
                    <Text>
                        {_(
                            'Are you sure that you want to delete %s passage?',
                            passageId
                        )}
                    </Text>
                    <SRow>
                        <Button color="error" variant="contained">
                            {_('Delete')}
                        </Button>
                        <Button
                            onClick={() => setOpen(false)}
                            variant="outlined"
                            color="inherit"
                        >
                            {_('Cancel')}
                        </Button>
                    </SRow>
                </SColumn>
            </Modal>
        </SColumn>
    );
};

const SText = styled(Text)`
    cursor: pointer;
    &:hover {
        color: yellow;
    }
`;

const SRow = styled(Row)`
    gap: ${spacingCss(1)};
    justify-content: end;
    min-width: 260px;
`;

const SColumn = styled(Column)`
    gap: ${spacingCss(2)};
`;
