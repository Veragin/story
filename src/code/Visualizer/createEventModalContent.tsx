import { Button, styled, Tooltip } from '@mui/material';
import { Column, Row } from 'code/Components/Basic';
import { useVisualizerStore } from 'code/Context';
import { ReactNode, useState } from 'react';
import { TEvent } from 'types/TEvent';
import { TEventId } from 'types/TIds';
import OpenInBrowserIcon from '@mui/icons-material/OpenInBrowser';
import DeleteIcon from '@mui/icons-material/Delete';
import AccessTimeFilledIcon from '@mui/icons-material/AccessTimeFilled';
import { SmallText, Text } from 'code/Components/Text';
import { spacingCss } from 'code/Components/css';
import { Modal } from 'code/Components/Modal';

export const createEventModalContent = (event: TEvent<TEventId>): ReactNode => (
    <EventModalContent event={event} />
);

const EventModalContent = ({ event }: { event: TEvent<TEventId> }) => {
    const [open, setOpen] = useState(false);
    const store = useVisualizerStore();

    const start = store.timeManager.renderTime(
        event.timeRange.start,
        'dateTime'
    );
    const end = store.timeManager.renderTime(event.timeRange.end, 'dateTime');

    return (
        <SColumn>
            <Tooltip title={_('Copy to clipboard')} placement="top">
                <SText
                    onClick={() => navigator.clipboard.writeText(event.eventId)}
                >
                    {event.eventId}
                </SText>
            </Tooltip>
            <SmallText>{`${start} - ${end}`}</SmallText>
            <SRow>
                <Tooltip title={_('Open in VS code')}>
                    <Button
                        variant="outlined"
                        color="inherit"
                        onClick={() => store.agent.openEvent(event.eventId)}
                    >
                        <OpenInBrowserIcon />
                    </Button>
                </Tooltip>
                <Tooltip title={_('Set time of the event')}>
                    <Button
                        variant="outlined"
                        color="inherit"
                        onClick={() => store.agent.openEvent(event.eventId)}
                    >
                        <AccessTimeFilledIcon />
                    </Button>
                </Tooltip>
                <Tooltip title={_('Delete event')}>
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
                title={_('Delete event %s', event.eventId)}
                open={open}
                onClose={() => setOpen(false)}
            >
                <SColumn>
                    <Text>
                        {_(
                            'Are you sure that you want to delete %s event?',
                            event.eventId
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
