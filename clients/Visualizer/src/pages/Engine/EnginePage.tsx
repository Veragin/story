import { useEffect } from 'react';
import { styled } from '@mui/material';
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
} from '../../components/SideMenu/SideMenu';
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
                <SPage>
                    <SideMenu groups={[{ title: _('Engine'), entries }]} />
                    <SEditorArea>
                        <EngineSectionEditor editor={editor} />
                    </SEditorArea>
                </SPage>
            </PageContainer>
        );
    }
);

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
