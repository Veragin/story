import { Link } from '@mui/material';
import { observer } from 'mobx-react-lite';
import type { TStructTypeDto } from '@story/visualizer-protocol';
import { router } from '../../shell';
import type { StructureEditorStore } from './StructureEditorStore';

type TProps = {
    type: TStructTypeDto;
    editor: StructureEditorStore;
};

export const CatalogLink = observer(({ type, editor }: TProps) => {
    const { catalog } = type;
    if (!catalog) return null;
    return (
        <Link
            href={router.href({ page: 'catalog', catalog: catalog.name })}
            data-meta="catalog"
        >
            {_(
                '%d %s → open in Entities',
                editor.entities.catalogOf(catalog.name).length,
                catalog.name
            )}
        </Link>
    );
});
