import { styled, Tab, Tabs } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import {
    SideMenu,
    type TSideMenuGroup,
} from '../../components/SideMenu/SideMenu';
import { modals, router, type TStructureSection } from '../../shell';
import { CreateLiteralDialog } from './CreateLiteralDialog';
import { CreateTypeDialog } from './CreateTypeDialog';
import type { StructureEditorStore } from './StructureEditorStore';

type TProps = {
    editor: StructureEditorStore;
};

type TListEntry = { name: string; secondary?: string };

type TGroup = {
    title: string;
    section: TStructureSection;
    entries: TListEntry[];
    onNew?: () => void;
};

export const StructureList = observer(({ editor }: TProps) => {
    const { structure } = editor;
    const [tab, setTab] = useState<TStructureSection>(editor.section);

    useEffect(() => setTab(editor.section), [editor.section]);

    const select = (section: TStructureSection, name: string) =>
        router.navigate({ page: 'structure', section, name });

    const newType = () =>
        modals.open((close) => (
            <CreateTypeDialog
                structure={structure}
                onCancel={close}
                onCreated={(type) => {
                    close();
                    select('types', type.name);
                }}
            />
        ));

    const newLiteral = () =>
        modals.open((close) => (
            <CreateLiteralDialog
                structure={structure}
                onCancel={close}
                onCreated={(literal) => {
                    close();
                    select('literals', literal.name);
                }}
            />
        ));

    const groups: TGroup[] = [
        {
            title: _('Literals'),
            section: 'literals',
            entries: structure.literals.map((literal) => ({
                name: literal.name,
                secondary: literal.scope === 'local' ? literal.file : undefined,
            })),
            onNew: newLiteral,
        },
        {
            title: _('Story types'),
            section: 'types',
            entries: structure.storyTypes.map((type) => ({
                name: type.name,
                secondary: type.catalog
                    ? _('catalog %s', type.catalog.name)
                    : undefined,
            })),
            onNew: newType,
        },
        {
            title: _('Engine types (extendable)'),
            section: 'types',
            entries: structure.extendableTypes.map((type) => ({
                name: type.name,
            })),
        },
    ];

    const isDirty = (section: TStructureSection) =>
        (section === 'types' ? editor.type : editor.literal).dirty;

    const menuGroups: TSideMenuGroup[] = groups
        .filter((group) => group.section === tab)
        .map((group) => ({
            title: group.title,
            onNew: group.onNew,
            newAction: `new-${group.section}`,
            entries: group.entries.map((entry) => {
                const selected =
                    editor.section === group.section &&
                    editor.name === entry.name;
                return {
                    ...entry,
                    href: router.href({
                        page: 'structure',
                        section: group.section,
                        name: entry.name,
                    }),
                    selected,
                    unsaved: selected && isDirty(group.section),
                };
            }),
        }));

    return (
        <SideMenu
            groups={menuGroups}
            header={
                <STabs
                    value={tab}
                    onChange={(_event, value: TStructureSection) =>
                        setTab(value)
                    }
                    variant="fullWidth"
                >
                    <Tab value="types" label={_('Types')} data-tab="types" />
                    <Tab
                        value="literals"
                        label={_('Literals')}
                        data-tab="literals"
                    />
                </STabs>
            }
        />
    );
});

const STabs = styled(Tabs)`
    flex: 0 0 auto;
    border-bottom: 1px solid ${({ theme }) => theme.palette.divider};
`;
