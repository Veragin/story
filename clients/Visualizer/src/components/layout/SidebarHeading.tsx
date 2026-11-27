import { Chip, InputBase, styled } from '@mui/material';
import { spacingCss } from '@story/ui';

type TProps = {
    title: string;
    badge?: string;
    onTitleChange?: (title: string) => void;
    placeholder?: string;
    disabled?: boolean;
    dataField?: string;
};

export const SidebarHeading = ({
    title,
    badge,
    onTitleChange,
    placeholder,
    disabled,
    dataField,
}: TProps) => (
    <SRow>
        {onTitleChange ? (
            <SInput
                value={title}
                onChange={(e) => onTitleChange(e.target.value)}
                placeholder={placeholder}
                disabled={disabled}
                fullWidth
                inputProps={{
                    'aria-label': _('Title'),
                    'data-field': dataField,
                }}
            />
        ) : (
            <STitle>{title}</STitle>
        )}
        {badge && <SBadge size="small" label={badge} />}
    </SRow>
);

const SRow = styled('div')`
    display: flex;
    align-items: center;
    gap: ${spacingCss(1)};
`;

const STitle = styled('h2')`
    flex: 1;
    min-width: 0;
    margin: 0;
    word-break: break-word;
    font-size: ${({ theme }) => theme.typography.h6.fontSize};
    font-weight: 600;
    line-height: 1.3;
`;

const SInput = styled(InputBase)`
    flex: 1;
    min-width: 0;
    font-size: ${({ theme }) => theme.typography.h6.fontSize};
    font-weight: 600;
    line-height: 1.3;

    & input {
        padding: 0;
        height: auto;
        border-radius: ${({ theme }) => theme.shape.borderRadius}px;
    }

    &:hover input {
        background: ${({ theme }) => theme.palette.action.hover};
    }
`;

const SBadge = styled(Chip)`
    flex-shrink: 0;
`;
