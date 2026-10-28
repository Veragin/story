import { styled } from '@mui/material';
import { spacingCss } from '@story/ui';

type TColorProps = {
    name: string;
    color: string;
    isActive: boolean;
    onClick: () => void;
};

export const Color = ({ color, isActive, name, onClick }: TColorProps) => (
    <SOption
        type="button"
        role="option"
        aria-selected={isActive}
        active={isActive}
        onClick={onClick}
    >
        <SSwatch style={{ backgroundColor: color }} />
        <SName>{name}</SName>
    </SOption>
);

const SOption = styled('button', {
    shouldForwardProp: (prop) => prop !== 'active',
})<{ active: boolean }>`
    display: flex;
    min-width: 0;
    align-items: center;
    gap: ${spacingCss(0.75)};
    padding: ${spacingCss(0.375)} ${spacingCss(0.75)};
    border: 1px solid
        ${({ theme, active }) =>
            active ? theme.palette.border.strong : 'transparent'};
    border-radius: 6px;
    background-color: ${({ theme, active }) =>
        active ? theme.palette.action.selected : 'transparent'};
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
    &:hover {
        background-color: ${({ theme }) => theme.palette.action.hover};
    }
`;

const SSwatch = styled('span')`
    flex-shrink: 0;
    width: 14px;
    height: 14px;
    border-radius: 4px;
    border: 1px solid ${({ theme }) => theme.palette.text.secondary};
`;

const SName = styled('span')`
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;
