import { InputBase, styled } from '@mui/material';

type TProps = {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    dataField?: string;
    minRows?: number;
};

export const DescriptionInput = ({
    value,
    onChange,
    disabled,
    dataField = 'docComment',
    minRows,
}: TProps) => (
    <SInput
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={_('Write down description here')}
        disabled={disabled}
        multiline
        minRows={minRows}
        fullWidth
        inputProps={{
            'aria-label': _('Author description'),
            'data-field': dataField,
        }}
    />
);

const SInput = styled(InputBase)`
    padding: 2px 4px;
    margin: 0 -4px;
    font-size: ${({ theme }) => theme.typography.body2.fontSize};
    line-height: 1.5;
    border-radius: ${({ theme }) => theme.shape.borderRadius}px;

    &:hover,
    &.Mui-focused {
        background: ${({ theme }) => theme.palette.action.hover};
    }
`;
