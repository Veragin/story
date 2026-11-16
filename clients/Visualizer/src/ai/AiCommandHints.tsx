import { ListItemButton, ListItemText, Paper, styled } from '@mui/material';
import { matchingCommands } from './aiCommands';

type TProps = {
    draft: string;
    onPick: (command: string) => void;
};

export const AiCommandHints = ({ draft, onPick }: TProps) => {
    const commands = matchingCommands(draft);
    if (commands.length === 0) return null;
    return (
        <SPopup elevation={6} role="listbox" aria-label={_('Commands')}>
            {commands.map((command) => (
                <ListItemButton
                    key={command.name}
                    dense
                    role="option"
                    aria-selected={false}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onPick(command.name)}
                >
                    <ListItemText
                        primary={<code>{command.usage}</code>}
                        secondary={command.description()}
                    />
                </ListItemButton>
            ))}
        </SPopup>
    );
};

const SPopup = styled(Paper)`
    position: absolute;
    left: 0;
    right: 0;
    bottom: 100%;
    z-index: 1;
    max-height: 240px;
    overflow-y: auto;
`;
