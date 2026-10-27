import styled from '@emotion/styled';
import { spacingCss } from '@story/ui';

export const List = styled.div`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-content: start;
    gap: ${spacingCss(0.25)};
    max-height: 240px;
    margin: 0 ${spacingCss(-0.75)};
    scrollbar-color: #666 transparent;
    scrollbar-width: thin;
    overflow-y: auto;
    overflow-x: hidden;
`;
