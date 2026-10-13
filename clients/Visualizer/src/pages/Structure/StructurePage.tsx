import { useEffect } from 'react';
import { Alert, CircularProgress, styled } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { entityStore, structureStore } from '../../context';
import { FormCenter } from '../../components/formLayout';
import { PageContainer, router, type TStructureSection } from '../../shell';
import { LiteralEditor } from './LiteralEditor';
import { StructureEditorStore } from './StructureEditorStore';
import { StructureList } from './StructureList';
import { TypeEditor } from './TypeEditor';

type TProps = {
    section?: TStructureSection;
    name?: string;
};

let editor: StructureEditorStore | null = null;

// module-level so switching tabs keeps the selection and the draft
const getEditor = () =>
    (editor ??= new StructureEditorStore({
        structure: structureStore,
        entities: entityStore,
    }));

export const StructurePage = observer(({ section, name }: TProps) => {
    const e = getEditor();

    useEffect(() => {
        const releaseEntities = entityStore.start();
        const stop = e.start();
        return () => {
            stop();
            releaseEntities();
        };
    }, [e]);

    useEffect(() => {
        if (!section && e.name) {
            router.navigate(
                { page: 'structure', section: e.section, name: e.name },
                { replace: true }
            );
            return;
        }
        e.show(section ?? 'types', name);
    }, [e, section, name]);

    const { structure } = e;

    return (
        <PageContainer>
            <SPage>
                <StructureList editor={e} />
                <SEditorArea>
                    {structure.error && (
                        <Alert severity="error" sx={{ m: 2 }}>
                            {structure.error}
                        </Alert>
                    )}
                    {!structure.loaded && structure.loading ? (
                        <FormCenter>
                            <CircularProgress size={24} />
                        </FormCenter>
                    ) : e.section === 'literals' ? (
                        <LiteralEditor editor={e} />
                    ) : (
                        <TypeEditor editor={e} />
                    )}
                </SEditorArea>
            </SPage>
        </PageContainer>
    );
});

const SPage = styled('div')`
    display: flex;
    flex: 1;
    min-height: 0;
    color: ${({ theme }) => theme.palette.text.primary};
    background: ${({ theme }) => theme.palette.background.default};
`;

const SEditorArea = styled('div')`
    flex: 1;
    min-width: 0;
    overflow: auto;
`;
