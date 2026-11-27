import { styled, Tooltip } from '@mui/material';
import type { TSummaryPart } from './linkSummary';

type TProps = {
    parts: TSummaryPart[];
};

export const SummaryParts = ({ parts }: TProps) =>
    parts.map((p, i) =>
        'code' in p ? (
            <Tooltip key={i} title={<SCodeTip>{p.code}</SCodeTip>}>
                <SFn>ƒ</SFn>
            </Tooltip>
        ) : (
            <span key={i}>{p.text}</span>
        )
    );

const SFn = styled('span')`
    font-style: italic;
    font-family: serif;
    padding: 0 1px;
    cursor: help;
    color: ${({ theme }) => theme.palette.text.code};
`;

const SCodeTip = styled('span')`
    font-family: 'JetBrains Mono', 'Fira Code', Menlo, Consolas, monospace;
    white-space: pre-wrap;
`;
