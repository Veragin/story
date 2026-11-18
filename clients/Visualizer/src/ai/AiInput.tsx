import { useEffect, useId, useLayoutEffect, useRef, type KeyboardEvent } from 'react';
import { styled, TextField } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import StopIcon from '@mui/icons-material/Stop';
import { AI_MESSAGE_MAX_LENGTH } from '@story/protocol';
import { Row, spacingCss } from '@story/ui';
import { observer } from 'mobx-react-lite';
import { TooltipIconButton } from '../components/buttons/TooltipIconButton';
import type { AiStore } from './AiStore';
import { AiSuggestions } from './AiSuggestions';

type TProps = {
    store: AiStore;
};

export const AiInput = observer(({ store }: TProps) => {
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const refocus = useRef(false);
    const listboxId = useId();
    const { suggest, focusRequest } = store;
    const disabled = store.locked;

    useEffect(() => {
        if (disabled || !refocus.current) return;
        refocus.current = false;
        inputRef.current?.focus();
    }, [disabled]);

    useLayoutEffect(() => {
        const input = inputRef.current;
        if (focusRequest === 0 || !input) return;
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
    }, [focusRequest]);

    const optionId = (index: number) => `${listboxId}-option-${index}`;

    const send = () => {
        if (!store.canSend) return;
        refocus.current = true;
        void store.send();
    };

    const handleSuggestionKey = (e: KeyboardEvent): boolean => {
        switch (e.key) {
            case 'Tab':
                if (e.shiftKey) return false;
                suggest.complete();
                return true;
            case 'ArrowDown':
            case 'ArrowUp':
                if (suggest.items.length === 0) return false;
                suggest.move(e.key === 'ArrowDown' ? 1 : -1);
                return true;
            case 'Enter':
                if (e.shiftKey || suggest.selected === null) return false;
                suggest.accept();
                return true;
            case 'Escape':
                e.stopPropagation();
                suggest.dismiss();
                return true;
            default:
                return false;
        }
    };

    const onKeyDown = (e: KeyboardEvent) => {
        if (e.nativeEvent.isComposing) return;
        if (suggest.open && handleSuggestionKey(e)) {
            e.preventDefault();
            return;
        }
        if (e.key !== 'Enter' || e.shiftKey) return;
        e.preventDefault();
        send();
    };

    return (
        <SRoot>
            <AiSuggestions suggest={suggest} id={listboxId} optionId={optionId} />
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
                        'role': 'combobox',
                        'aria-autocomplete': 'list',
                        'aria-expanded': suggest.open,
                        'aria-controls': suggest.open ? listboxId : undefined,
                        'aria-activedescendant':
                            suggest.open && suggest.selected !== null ? optionId(suggest.selected) : undefined,
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
