import { styled } from '@mui/material';
import { spacingCss } from '@story/ui';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { TooltipIconButton } from '../../../../components/buttons/TooltipIconButton';
import { DeleteButton } from '../../../../components/buttons/DeleteButton';
import type { TLinkDto } from '@story/protocol';
import type { TOption } from '../../../../structure/option';
import { linkSummary } from './linkSummary';
import { SummaryParts } from './SummaryParts';

type TProps = {
    link: TLinkDto;
    itemOptions: TOption[];
    expanded: boolean;
    onToggle: () => void;
    onRemove: () => void;
    hasError: boolean;
};

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
                        <SummaryParts parts={text} />
                    </SText>
                ) : (
                    <SNoText>{_('(no text)')}</SNoText>
                )}{' '}
                <SDetails>
                    <SummaryParts parts={details} />
                </SDetails>
            </SLine>
            <TooltipIconButton
                title={
                    hasError
                        ? _('The link has errors: it stays open')
                        : toggleLabel
                }
                icon={expanded ? ExpandLessIcon : ExpandMoreIcon}
                aria-expanded={expanded}
                data-action="toggle-link"
                disabled={hasError}
                onClick={onToggle}
            />
            <DeleteButton
                iconOnly
                label={_('Remove link')}
                onClick={onRemove}
            />
        </SRow>
    );
};

const SRow = styled('div')`
    display: flex;
    align-items: center;
    gap: ${spacingCss(0.25)};
    &[data-error='true'] {
        color: ${({ theme }) => theme.palette.error.main};
    }
`;

const SLine = styled('div')`
    flex: 1;
    min-width: 0;
    font-size: ${({ theme }) => theme.typography.body2.fontSize};
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
