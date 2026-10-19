import styled from '@emotion/styled';
import { Row, spacingCss } from '@story/ui';

type TColorProps = {
    name: string;
    color: string;
    isActive: boolean;
    onClick: () => void;
};

export const Color = ({ color, isActive, name, onClick }: TColorProps) => {
    return (
        <SRow
            $isActive={isActive}
            onClick={onClick}
            onWheel={(e) => e.stopPropagation()}
            onMouseMove={(e) => e.stopPropagation()}
        >
            <SColor color={color}></SColor>
            <span>{name}</span>
        </SRow>
    );
};

const SRow = styled(Row)<{ $isActive: boolean }>`
    background-color: ${({ $isActive }) => ($isActive ? '#444' : '#000')};
    color: ${({ $isActive }) => ($isActive ? '#fff' : '#ddd')};
    &:hover {
        background-color: #333;
    }
    padding: ${spacingCss(0.5)};
    gap: ${spacingCss(0.5)};
    cursor: pointer;
    align-self: stretch;
`;

const SColor = styled.div<{ color: string }>`
    background-color: ${({ color }) => color};
    width: 20px;
    height: 20px;
    border-radius: 4px;
    border: 1px solid #000;
`;
