import { TextField as MuiTextField, TextFieldProps } from '@mui/material';

/**
 * Key events are left to bubble: the window-level shortcuts (`shell/keyboard.ts`) and the canvas
 * (`Scene`) ignore typing targets themselves unless a handler opts in (the save shortcuts), and
 * MUI `Modal` needs Escape to reach it.
 */
export const TextField = (props: TextFieldProps) => <MuiTextField {...props} />;
