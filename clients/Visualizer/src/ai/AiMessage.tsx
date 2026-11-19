import { styled } from '@mui/material';
import type { TAiMessageDto } from '@story/protocol';
import { spacingCss } from '@story/ui';

type TProps = {
    message: TAiMessageDto;
};

export const AiMessage = ({ message }: TProps) => {
    switch (message.kind) {
        case 'user':
            return <SUser data-kind="user">{message.text}</SUser>;
        case 'assistant':
            return (
                <SAssistant data-kind="assistant">{message.text}</SAssistant>
            );
        case 'system':
            return <SSystem data-kind="system">{message.text}</SSystem>;
    }
};

const SBubble = styled('div')`
    max-width: 90%;
    padding: ${spacingCss(1)} ${spacingCss(1.5)};
    border-radius: ${({ theme }) => theme.shape.borderRadius * 2}px;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font-size: ${({ theme }) => theme.typography.body2.fontSize};
`;

const SUser = styled(SBubble)`
    align-self: flex-end;
    background-color: ${({ theme }) => theme.palette.primary.dark};
    color: ${({ theme }) => theme.palette.primary.contrastText};
`;

const SAssistant = styled(SBubble)`
    align-self: flex-start;
    background-color: ${({ theme }) => theme.palette.action.hover};
`;

const SSystem = styled('div')`
    align-self: stretch;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font-size: ${({ theme }) => theme.typography.meta.fontSize};
    color: ${({ theme }) => theme.palette.text.secondary};
    border-left: 2px solid ${({ theme }) => theme.palette.border.strong};
    padding-left: ${spacingCss(1)};
`;
