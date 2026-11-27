import { useState } from 'react';
import { Button, styled } from '@mui/material';
import { Column } from '@story/ui';

const VISIBLE_FILES = 3;

type TProps = {
    files: readonly string[];
};

export const AiTouchedFiles = ({ files }: TProps) => {
    const [expanded, setExpanded] = useState(false);
    const hidden = files.length - VISIBLE_FILES;
    const shown =
        expanded || hidden <= 0 ? files : files.slice(0, VISIBLE_FILES);
    return (
        <SFiles>
            {shown.map((file) => (
                <SFile key={file}>{file}</SFile>
            ))}
            {hidden > 0 && (
                <SMore size="small" onClick={() => setExpanded(!expanded)}>
                    {expanded ? _('Show less') : _('%d more', hidden)}
                </SMore>
            )}
        </SFiles>
    );
};

const SFiles = styled(Column)`
    align-items: flex-start;
`;

const SFile = styled('code')`
    max-width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: ${({ theme }) => theme.palette.text.primary};
`;

const SMore = styled(Button)`
    min-width: 0;
    padding: 0;
    text-transform: none;
    font-size: inherit;
`;
