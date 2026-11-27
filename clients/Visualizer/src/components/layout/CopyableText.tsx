import { useEffect, useState } from 'react';
import { ButtonBase, styled, Tooltip } from '@mui/material';

const FEEDBACK_MS = 1500;

type TCopyState = 'idle' | 'copied' | 'failed';

type TProps = {
    value: string;
};

export const CopyableText = ({ value }: TProps) => {
    const [state, setState] = useState<TCopyState>('idle');

    useEffect(() => {
        if (state === 'idle') return;
        const timer = setTimeout(() => setState('idle'), FEEDBACK_MS);
        return () => clearTimeout(timer);
    }, [state]);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(value);
            setState('copied');
        } catch {
            setState('failed');
        }
    };

    const tooltip = {
        idle: _('Click to copy'),
        copied: _('Copied'),
        failed: _('Could not copy'),
    }[state];

    return (
        <Tooltip title={tooltip}>
            <SText
                onClick={() => void copy()}
                data-copy={value}
                data-copy-state={state}
            >
                {value}
            </SText>
        </Tooltip>
    );
};

const SText = styled(ButtonBase)`
    display: inline;
    padding: 0 2px;
    font: inherit;
    color: inherit;
    text-align: left;
    word-break: break-all;
    border-radius: ${({ theme }) => theme.shape.borderRadius}px;

    &:hover {
        color: ${({ theme }) => theme.palette.text.primary};
        background: ${({ theme }) => theme.palette.action.hover};
    }
`;
