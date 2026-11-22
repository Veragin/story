import { styled, ToggleButtonGroup } from '@mui/material';

const ICON_SIZE = 20;
const BUTTON_PADDING_X = 6;
const BORDER_WIDTH = 1;

export const VIEW_TOGGLE_WIDTH =
    ICON_SIZE + 2 * (BUTTON_PADDING_X + BORDER_WIDTH);

export const ViewToggle = styled(ToggleButtonGroup)`
    & .MuiToggleButton-root {
        padding: 2px ${BUTTON_PADDING_X}px;
    }
`;
