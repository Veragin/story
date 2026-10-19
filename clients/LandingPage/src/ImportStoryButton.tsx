import { useRef, useState } from 'react';
import { Button } from '@mui/material';
import { FileUpload } from '@mui/icons-material';
import { STORY_ZIP_CONTENT_TYPE, type TImportStoryBody } from '@story/protocol';
import { showToast } from '@story/ui';
import { ImportStoryDialog } from './ImportStoryDialog';
import type { StoriesStore } from './StoriesStore';

export const ImportStoryButton = ({ store }: { store: StoriesStore }) => {
    const input = useRef<HTMLInputElement>(null);
    const [file, setFile] = useState<File | null>(null);

    const pick = (picked: File | undefined) => {
        if (input.current) input.current.value = ''; // picking the same file again fires again
        if (picked) setFile(picked);
    };

    const upload = async (zip: File, body: TImportStoryBody) => {
        const story = await store.importZip(zip, body);
        setFile(null);
        showToast(_('Imported "%s"', story.name), { variant: 'success' });
    };

    return (
        <>
            <Button
                variant="outlined"
                startIcon={<FileUpload />}
                onClick={() => input.current?.click()}
            >
                {_('Import')}
            </Button>
            <input
                ref={input}
                type="file"
                accept={`.zip,${STORY_ZIP_CONTENT_TYPE}`}
                hidden
                onChange={(e) => pick(e.target.files?.[0])}
            />
            {file && (
                <ImportStoryDialog
                    fileName={file.name}
                    onSubmit={(body) => upload(file, body)}
                    onClose={() => setFile(null)}
                />
            )}
        </>
    );
};
