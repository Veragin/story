import { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import {
    ENGINE_SECTIONS,
    type TEngineSection,
    type TEngineSectionDto,
} from '@story/protocol';
import { api, apiEvents } from '../../api';
import {
    SideMenu,
    type TSideMenuEntry,
} from '../../components/layout/SideMenu';
import { MasterDetailPage } from '../../components/layout/MasterDetailPage';
import { PageContainer, router } from '../../shell';
import { EngineEditorStore } from './EngineEditorStore';
import { EngineSectionEditor } from './EngineSectionEditor';
import { ENGINE_SECTION_INFO } from './engineSections';

type TProps = {
    section?: TEngineSection;
    editor?: EngineEditorStore;
};

let engineEditor: EngineEditorStore | null = null;

// module-level so switching tabs keeps the selection and the draft
const getEngineEditor = () =>
    (engineEditor ??= new EngineEditorStore({ api, events: apiEvents }));

const secondaryOf = (dto: TEngineSectionDto | undefined) => {
    if (!dto) return undefined;
    if (!dto.exists) return _('default');
    return dto.description.trim().split('\n')[0] || undefined;
};

export const EnginePage = observer(
    ({ section, editor = getEngineEditor() }: TProps) => {
        useEffect(() => editor.start(), [editor]);

        useEffect(() => {
            if (!section) {
                router.navigate(
                    { page: 'engine', section: editor.section },
                    { replace: true }
                );
                return;
            }
            editor.show(section);
        }, [editor, section]);

        const entries = ENGINE_SECTIONS.map((name): TSideMenuEntry => {
            const dto = editor.sections[name];
            const selected = editor.section === name;
            return {
                name,
                label: ENGINE_SECTION_INFO[name].title(),
                secondary: secondaryOf(dto),
                href: router.href({ page: 'engine', section: name }),
                selected,
                unsaved: selected && editor.resource.dirty,
                chip:
                    dto?.exists && !dto.implemented
                        ? _('not implemented')
                        : undefined,
            };
        });

        return (
            <PageContainer>
                <MasterDetailPage
                    list={
                        <SideMenu groups={[{ title: _('Engine'), entries }]} />
                    }
                >
                    <EngineSectionEditor editor={editor} />
                </MasterDetailPage>
            </PageContainer>
        );
    }
);
