import type { TDeleteReferencesDto } from '@story/visualizer-protocol';
import { modals } from '../../shell';
import { DeletePreviewDialog } from './DeletePreviewDialog';

type TConfirmDelete = {
    title: string;
    message: string;
    preview: () => Promise<TDeleteReferencesDto>;
};

export const confirmDelete = (options: TConfirmDelete): Promise<boolean> =>
    new Promise((resolve) => {
        let answer = false;
        modals.open(
            (close) => (
                <DeletePreviewDialog
                    {...options}
                    onAnswer={(value) => {
                        answer = value;
                        close();
                    }}
                />
            ),
            { onClose: () => resolve(answer) }
        );
    });
