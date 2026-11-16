import { useLayoutEffect, useRef } from 'react';
import { styled } from '@mui/material';
import type { TAiMessageDto } from '@story/protocol';
import { Column, spacingCss } from '@story/ui';
import { observer } from 'mobx-react-lite';
import { EmptyState } from '../components/feedback/EmptyState';
import { AiMessage } from './AiMessage';

const BOTTOM_SLACK_PX = 24;

type TProps = {
    messages: readonly TAiMessageDto[];
};

export const AiMessageList = observer(({ messages }: TProps) => {
    const listRef = useRef<HTMLDivElement>(null);
    const stickToBottom = useRef(true);

    useLayoutEffect(() => {
        const el = listRef.current;
        if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
    });

    const onScroll = () => {
        const el = listRef.current;
        if (!el) return;
        stickToBottom.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_SLACK_PX;
    };

    return (
        <SList ref={listRef} onScroll={onScroll} role="log">
            {messages.length === 0 ? (
                <EmptyState
                    message={_(
                        'Ask the agent to change the story. Type / for commands.'
                    )}
                />
            ) : (
                messages.map((message) => (
                    <AiMessage key={message.id} message={message} />
                ))
            )}
        </SList>
    );
});

const SList = styled(Column)`
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    gap: ${spacingCss(1)};
    padding: ${spacingCss(1.5)};
`;
