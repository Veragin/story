import { useEffect, useRef, type KeyboardEvent } from 'react';
import { styled, TextField } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import StopIcon from '@mui/icons-material/Stop';
import { AI_MESSAGE_MAX_LENGTH } from '@story/protocol';
import { Row, spacingCss } from '@story/ui';
import { observer } from 'mobx-react-lite';
import { TooltipIconButton } from '../components/buttons/TooltipIconButton';
import { AiCommandHints } from './AiCommandHints';
import type { AiStore } from './AiStore';

type TProps = {
    store: AiStore;
};

export const AiInput = observer(({ store }: TProps) => {
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const refocus = useRef(false);
    const disabled = store.locked;

    useEffect(() => {
        if (disabled || !refocus.current) return;
        refocus.current = false;
        inputRef.current?.focus();
    }, [disabled]);

    const send = () => {
        if (!store.canSend) return;
        refocus.current = true;
        void store.send();
    };

    const onKeyDown = (e: KeyboardEvent) => {
        if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) {
            return;
        }
        e.preventDefault();
        send();
    };

    const pickCommand = (command: string) => {
        store.setDraft(`${command} `);
        inputRef.current?.focus();
    };

    return (
        <SRoot>
            {!disabled && (
                <AiCommandHints draft={store.draft} onPick={pickCommand} />
            )}
            <STextField
                multiline
                minRows={2}
                maxRows={8}
                size="small"
                placeholder={_('Message the agent…')}
                value={store.draft}
                disabled={disabled}
                onChange={(e) => store.setDraft(e.target.value)}
                onKeyDown={onKeyDown}
                inputRef={inputRef}
                slotProps={{
                    htmlInput: {
                        'aria-label': _('Message'),
                        'maxLength': AI_MESSAGE_MAX_LENGTH,
                    },
                }}
            />
            {store.working ? (
                <TooltipIconButton
                    title={_('Stop')}
                    icon={StopIcon}
                    tone="error"
                    onClick={() => void store.interrupt()}
                />
            ) : (
                <TooltipIconButton
                    title={_('Send')}
                    icon={SendIcon}
                    tone="inherit"
                    disabled={!store.canSend}
                    onClick={send}
                />
            )}
        </SRoot>
    );
});

const SRoot = styled(Row)`
    position: relative;
    align-items: flex-end;
    gap: ${spacingCss(0.5)};
    padding: ${spacingCss(1)};
    border-top: 1px solid ${({ theme }) => theme.palette.border.subtle};
`;

const STextField = styled(TextField)`
    flex: 1;
`;
