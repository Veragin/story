import { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { styled } from '@mui/material';
import { spacingCss } from '@story/ui';
import { entityStore, structureStore } from '../../context';
import { ErrorAlert } from '../../components/feedback/ErrorAlert';
import { LoadingState } from '../../components/feedback/LoadingState';
import { MasterDetailPage } from '../../components/layout/MasterDetailPage';
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
            <MasterDetailPage list={<StructureList editor={e} />}>
                <SErrorAlert error={structure.error} />
                {!structure.loaded && structure.loading ? (
                    <LoadingState />
                ) : e.section === 'literals' ? (
                    <LiteralEditor editor={e} />
                ) : (
                    <TypeEditor editor={e} />
                )}
            </MasterDetailPage>
        </PageContainer>
    );
});

const SErrorAlert = styled(ErrorAlert)`
    margin: ${spacingCss(2)};
`;
