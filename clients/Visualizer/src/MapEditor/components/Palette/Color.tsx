import styled from '@emotion/styled';
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
        $isActive={isActive}
        onClick={onClick}
    >
        <SSwatch style={{ backgroundColor: color }} />
        <SName>{name}</SName>
    </SOption>
);

const SOption = styled.button<{ $isActive: boolean }>`
    display: flex;
    min-width: 0;
    align-items: center;
    gap: ${spacingCss(0.75)};
    padding: ${spacingCss(0.375)} ${spacingCss(0.75)};
    border: 1px solid
        ${({ $isActive }) =>
            $isActive ? 'rgba(255, 255, 255, 0.5)' : 'transparent'};
    border-radius: 6px;
    background-color: ${({ $isActive }) =>
        $isActive ? 'rgba(255, 255, 255, 0.12)' : 'transparent'};
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
    &:hover {
        background-color: rgba(255, 255, 255, 0.08);
    }
`;

const SSwatch = styled.span`
    flex-shrink: 0;
    width: 14px;
    height: 14px;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.6);
`;

const SName = styled.span`
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;
