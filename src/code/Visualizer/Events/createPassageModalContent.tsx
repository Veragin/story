import { Button, styled, Tooltip } from '@mui/material';
import { Column, Row } from 'code/components/Basic';
import { useVisualizerStore } from 'code/Context';
import { ReactNode, useState } from 'react';
import { TEventId } from 'types/TIds';
import OpenInBrowserIcon from '@mui/icons-material/OpenInBrowser';
import DeleteIcon from '@mui/icons-material/Delete';
import { Text } from 'code/components/Text';
import { spacingCss } from 'code/components/css';
import { Modal } from 'code/components/Modal';
import { TEventPassage } from 'types/TPassage';

export const createPassageModalContent = (
    passage: TEventPassage<TEventId>
): ReactNode => <PassageModalContent passage={passage} />;

const PassageModalContent = ({
    passage,
}: {
    passage: TEventPassage<TEventId>;
}) => {
    const [open, setOpen] = useState(false);
    const store = useVisualizerStore();

    return (
        <SColumn>
            <Tooltip title={_('Copy to clipboard')} placement="top">
                <SText
                    onClick={() => navigator.clipboard.writeText(passage.id)}
                >
                    {passage.id}
                </SText>
            </Tooltip>
            <SRow>
                <Tooltip title={_('Open in VS code')}>
                    <Button
                        variant="outlined"
                        color="inherit"
                        onClick={() => store.agent.openPassage(passage.id)}
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
                title={_('Delete passage %s', passage.id)}
                open={open}
                onClose={() => setOpen(false)}
            >
                <SColumn>
                    <Text>
                        {_(
                            'Are you sure that you want to delete %s passage?',
                            passage.id
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
