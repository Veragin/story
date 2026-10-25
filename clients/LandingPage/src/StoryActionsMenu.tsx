import { useRef, useState } from 'react';
import {
    IconButton,
    ListItemIcon,
    ListItemText,
    Menu,
    MenuItem,
    Tooltip,
} from '@mui/material';
import { Download, FileUpload, Language, MoreVert } from '@mui/icons-material';
import { STORY_ZIP_CONTENT_TYPE } from '@story/protocol';

type TProps = {
    onExport: () => void;
    onExportWeb: () => void;
    onImport: (zip: File) => void;
};

export const StoryActionsMenu = ({
    onExport,
    onExportWeb,
    onImport,
}: TProps) => {
    const [anchor, setAnchor] = useState<HTMLElement | null>(null);
    const input = useRef<HTMLInputElement>(null);

    const choose = (action: () => void) => {
        setAnchor(null);
        action();
    };

    const pick = (picked: File | undefined) => {
        if (input.current) input.current.value = ''; // picking the same file again fires again
        if (picked) onImport(picked);
    };

    return (
        <>
            <Tooltip title={_('More actions')}>
                <IconButton
                    size="small"
                    aria-label={_('More actions')}
                    aria-haspopup="menu"
                    aria-expanded={anchor !== null}
                    onClick={(e) => setAnchor(e.currentTarget)}
                >
                    <MoreVert />
                </IconButton>
            </Tooltip>
            <Menu
                anchorEl={anchor}
                open={anchor !== null}
                onClose={() => setAnchor(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                <MenuItem onClick={() => choose(onExport)}>
                    <ListItemIcon>
                        <Download fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>{_('Export')}</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => choose(onExportWeb)}>
                    <ListItemIcon>
                        <Language fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                        primary={_('Export for web')}
                        secondary={_(
                            'A zip to upload to any web host: players open its index.html'
                        )}
                    />
                </MenuItem>
                <MenuItem onClick={() => choose(() => input.current?.click())}>
                    <ListItemIcon>
                        <FileUpload fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                        primary={_('Import')}
                        secondary={_('Add the files of a story zip')}
                    />
                </MenuItem>
            </Menu>
            <input
                ref={input}
                type="file"
                accept={`.zip,${STORY_ZIP_CONTENT_TYPE}`}
                hidden
                onChange={(e) => pick(e.target.files?.[0])}
            />
        </>
    );
};
