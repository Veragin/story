import { IconButton, styled, Tooltip } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import type { TLinkDto } from '@story/visualizer-protocol';
import type { TOption } from '../../../../components/inputs/inputTypes';
import { linkSummary, type TSummaryPart } from './linkSummary';

type TProps = {
    link: TLinkDto;
    itemOptions: TOption[];
    expanded: boolean;
    onToggle: () => void;
    onRemove: () => void;
    hasError: boolean;
};

const Parts = ({ parts }: { parts: TSummaryPart[] }) =>
    parts.map((p, i) =>
        'code' in p ? (
            <Tooltip key={i} title={<SCodeTip>{p.code}</SCodeTip>}>
                <SFn>ƒ</SFn>
            </Tooltip>
        ) : (
            <span key={i}>{p.text}</span>
        )
    );

export const LinkSummary = ({
    link,
    itemOptions,
    expanded,
    onToggle,
    onRemove,
    hasError,
}: TProps) => {
    const { text, details } = linkSummary(link, itemOptions);
    const toggleLabel = expanded ? _('Collapse link') : _('Expand link');
    return (
        <SRow data-error={hasError ? 'true' : undefined}>
            <SLine onClick={hasError ? undefined : onToggle}>
                {text.length > 0 ? (
                    <SText>
                        <Parts parts={text} />
                    </SText>
                ) : (
                    <SNoText>{_('(no text)')}</SNoText>
                )}{' '}
                <SDetails>
                    <Parts parts={details} />
                </SDetails>
            </SLine>
            <Tooltip
                title={
                    hasError
                        ? _('The link has errors: it stays open')
                        : toggleLabel
                }
            >
                <span>
                    <IconButton
                        size="small"
                        aria-label={toggleLabel}
                        aria-expanded={expanded}
                        data-action="toggle-link"
                        disabled={hasError}
                        onClick={onToggle}
                    >
                        {expanded ? (
                            <ExpandLessIcon fontSize="small" />
                        ) : (
                            <ExpandMoreIcon fontSize="small" />
                        )}
                    </IconButton>
                </span>
            </Tooltip>
            <Tooltip title={_('Remove link')}>
                <IconButton
                    size="small"
                    aria-label={_('Remove link')}
                    onClick={onRemove}
                >
                    <DeleteIcon fontSize="small" />
                </IconButton>
            </Tooltip>
        </SRow>
    );
};

const SRow = styled('div')`
    display: flex;
    align-items: center;
    gap: 2px;
    &[data-error='true'] {
        color: ${({ theme }) => theme.palette.error.main};
    }
`;

const SLine = styled('div')`
    flex: 1;
    min-width: 0;
    font-size: 14px;
    line-height: 1.4;
    cursor: pointer;
    word-break: break-word;
`;

const SText = styled('span')`
    font-weight: 500;
`;

const SNoText = styled('span')`
    font-style: italic;
    color: ${({ theme }) => theme.palette.text.disabled};
`;

const SDetails = styled('span')`
    color: ${({ theme }) => theme.palette.text.secondary};
`;

const SFn = styled('span')`
    font-style: italic;
    font-family: serif;
    padding: 0 1px;
    cursor: help;
    color: #e6db74;
`;

const SCodeTip = styled('span')`
    font-family: 'JetBrains Mono', 'Fira Code', Menlo, Consolas, monospace;
    white-space: pre-wrap;
`;
