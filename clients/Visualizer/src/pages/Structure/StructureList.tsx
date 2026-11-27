import { styled, Tab, Tabs } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import {
    SideMenu,
    type TSideMenuEntry,
    type TSideMenuGroup,
} from '../../components/layout/SideMenu';
import { router, type TStructureSection } from '../../shell';
import { askNewClass, askNewLiteral, askNewType } from './structureDialogs';
import type { StructureEditorStore } from './StructureEditorStore';

type TProps = {
    editor: StructureEditorStore;
};

type TListEntry = {
    name: string;
    secondary?: string;
};

type TGroup = {
    title: string;
    section: TStructureSection;
    entries: TListEntry[];
    onNew?: () => void;
};

export const StructureList = observer(({ editor }: TProps) => {
    const { structure } = editor;
    // a private type or literal belongs to its class's page
    const selectedOwner =
        editor.selectedType?.owner ?? editor.selectedLiteral?.owner;
    const selectedTab: TStructureSection = selectedOwner
        ? 'classes'
        : editor.section;
    const [tab, setTab] = useState<TStructureSection>(selectedTab);

    useEffect(() => setTab(selectedTab), [selectedTab]);

    const select = (section: TStructureSection, name: string) =>
        router.navigate({ page: 'structure', section, name });

    const newClass = async () => {
        const type = await askNewClass(structure);
        if (type) select('classes', type.name);
    };

    const newType = async () => {
        const type = await askNewType(structure);
        if (type) select('types', type.name);
    };

    const newLiteral = async () => {
        const literal = await askNewLiteral(structure);
        if (literal) select('literals', literal.name);
    };

    const groups: TGroup[] = [
        {
            title: _('Story classes'),
            section: 'classes',
            entries: structure.storyClasses.map((type) => ({
                name: type.name,
                secondary: type.catalog?.name,
            })),
            onNew: () => void newClass(),
        },
        {
            title: _('Built-in classes (extendable)'),
            section: 'classes',
            entries: structure.builtInClasses.map((type) => ({
                name: type.name,
            })),
        },
        {
            title: _('Story types'),
            section: 'types',
            entries: structure.publicStoryTypes.map((type) => ({
                name: type.name,
            })),
            onNew: () => void newType(),
        },
        {
            title: _('Engine types (extendable)'),
            section: 'types',
            entries: structure.extendableTypes.map((type) => ({
                name: type.name,
            })),
        },
        {
            title: _('Literals'),
            section: 'literals',
            entries: structure.publicLiterals.map((literal) => ({
                name: literal.name,
                secondary: literal.scope === 'local' ? literal.file : undefined,
            })),
            onNew: () => void newLiteral(),
        },
    ];

    const unsaved = (
        editor.section === 'literals' ? editor.literal : editor.type
    ).dirty;
    const selectedName = selectedOwner ?? editor.name;

    const menuEntry = (
        entry: TListEntry,
        section: TStructureSection
    ): TSideMenuEntry => {
        const selected = selectedTab === section && selectedName === entry.name;
        return {
            name: entry.name,
            secondary: entry.secondary,
            href: router.href({ page: 'structure', section, name: entry.name }),
            selected,
            unsaved: selected && unsaved,
        };
    };

    const menuGroups: TSideMenuGroup[] = groups
        .filter((group) => group.section === tab)
        .map((group) => ({
            title: group.title,
            onNew: group.onNew,
            newAction: `new-${group.section}`,
            entries: group.entries.map((entry) =>
                menuEntry(entry, group.section)
            ),
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
                    <Tab
                        value="classes"
                        label={_('Classes')}
                        data-tab="classes"
                    />
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
