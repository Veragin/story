import styled from '@emotion/styled';
import { Tooltip } from '@mui/material';

type Props = {
    value: string;
    onChange: (color: string) => void;
    label: string;
    disabled?: boolean;
    size?: number;
};

export const ColorSwatchInput = ({
    value,
    onChange,
    label,
    disabled = false,
    size = 28,
}: Props) => (
    <Tooltip title={label}>
        <SLabel $disabled={disabled}>
            <SInput
                type="color"
                value={value}
                disabled={disabled}
                aria-label={label}
                onChange={(e) => onChange(e.target.value)}
            />
            <SSwatch
                style={{ backgroundColor: value, width: size, height: size }}
            />
        </SLabel>
    </Tooltip>
);

const SLabel = styled.label<{ $disabled: boolean }>`
    position: relative;
    display: inline-flex;
    flex-shrink: 0;
    cursor: ${({ $disabled }) => ($disabled ? 'default' : 'pointer')};
    opacity: ${({ $disabled }) => ($disabled ? 0.4 : 1)};
`;

const SInput = styled.input`
    position: absolute;
    inset: 0;
    opacity: 0;
    width: 100%;
    height: 100%;
    cursor: inherit;
`;

const SSwatch = styled.span`
    border-radius: 6px;
    border: 2px solid #fff;
`;
