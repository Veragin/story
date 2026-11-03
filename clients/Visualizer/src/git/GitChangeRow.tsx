import { styled, Typography } from '@mui/material';
import { spacingCss } from '@story/ui';
import { Checkbox } from '../components/inputs/Checkbox';

type TProps = {
    path: string;
    checked: boolean;
    disabled?: boolean;
    onChange: (checked: boolean) => void;
};

export const GitChangeRow = ({ path, checked, disabled, onChange }: TProps) => (
    <SRow data-path={path}>
        <Checkbox
            value={checked}
            onChange={onChange}
            disabled={disabled}
            ariaLabel={path}
        />
        <SPath variant="body2">{path}</SPath>
    </SRow>
);

const SRow = styled('label')`
    display: flex;
    align-items: center;
    gap: ${spacingCss(0.5)};
    cursor: pointer;
`;

const SPath = styled(Typography)`
    font-family: monospace;
    word-break: break-all;
`;
