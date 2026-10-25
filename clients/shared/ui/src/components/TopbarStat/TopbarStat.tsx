import type { SvgIconComponent } from '@mui/icons-material';
import { styled, Tooltip } from '@mui/material';
import type { ReactNode } from 'react';
import { Row } from '../Basic';
import { spacingCss } from '../css';
import { Text } from '../Text';

type Props = {
    icon: SvgIconComponent;
    label: string;
    value: ReactNode;
    tooltip?: ReactNode;
};

export const TopbarStat = ({
    icon: Icon,
    label,
    value,
    tooltip = label,
}: Props) => (
    <Tooltip title={tooltip}>
        <SStat>
            <Icon />
            <Text>{value}</Text>
        </SStat>
    </Tooltip>
);

const SStat = styled(Row)`
    align-items: center;
    gap: ${spacingCss(0.5)};
    width: 90px;
`;
