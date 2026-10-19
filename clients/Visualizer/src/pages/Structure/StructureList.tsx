import {
    Button,
    List,
    ListItemButton,
    ListItemText,
    ListSubheader,
    styled,
    Tab,
    Tabs,
    Tooltip,
} from '@mui/material';
import Add from '@mui/icons-material/Add';
import FiberManualRecord from '@mui/icons-material/FiberManualRecord';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { spacingCss } from '@story/ui';
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

    const visibleGroups = groups.filter((group) => group.section === tab);

    const isDirty = (section: TStructureSection) =>
        (section === 'types' ? editor.type : editor.literal).dirty;

    return (
        <SColumn>
            <STabs
                value={tab}
                onChange={(_event, value: TStructureSection) => setTab(value)}
                variant="fullWidth"
            >
                <Tab value="types" label={_('Types')} data-tab="types" />
                <Tab value="literals" label={_('Literals')} data-tab="literals" />
            </STabs>
            <SList dense>
                {visibleGroups.map((group) => (
                    <li key={group.title} data-group={group.title}>
                        <ul>
                            <SSubheader>
                                <span>{group.title}</span>
                                {group.onNew && (
                                    <Button
                                        size="small"
                                        startIcon={<Add fontSize="small" />}
                                        onClick={group.onNew}
                                        data-action={`new-${group.section}`}
                                    >
                                        {_('New')}
                                    </Button>
                                )}
                            </SSubheader>
                            {group.entries.map((entry) => {
                                const selected =
                                    editor.section === group.section &&
                                    editor.name === entry.name;
                                return (
                                    <ListItemButton
                                        key={entry.name}
                                        component="a"
                                        href={router.href({
                                            page: 'structure',
                                            section: group.section,
                                            name: entry.name,
                                        })}
                                        selected={selected}
                                        data-name={entry.name}
                                    >
                                        <ListItemText
                                            primary={entry.name}
                                            secondary={entry.secondary}
                                        />
                                        {selected && isDirty(group.section) && (
                                            <Tooltip
                                                title={_('Unsaved changes')}
                                            >
                                                <FiberManualRecord
                                                    color="warning"
                                                    sx={{ fontSize: 10 }}
                                                />
                                            </Tooltip>
                                        )}
                                    </ListItemButton>
                                );
                            })}
                            {group.entries.length === 0 && (
                                <SEmpty>{_('None yet.')}</SEmpty>
                            )}
                        </ul>
                    </li>
                ))}
            </SList>
        </SColumn>
    );
});

const SColumn = styled('div')`
    display: flex;
    flex-direction: column;
    width: 260px;
    flex: 0 0 260px;
    min-height: 0;
    border-right: 1px solid ${({ theme }) => theme.palette.divider};
    background: ${({ theme }) => theme.palette.background.paper};
`;

const STabs = styled(Tabs)`
    flex: 0 0 auto;
    border-bottom: 1px solid ${({ theme }) => theme.palette.divider};
`;

const SList = styled(List)`
    flex: 1;
    overflow: auto;
    padding: 0;
    & ul {
        padding: 0;
    }
    & > li + li {
        border-top: 1px solid ${({ theme }) => theme.palette.divider};
    }
`;

const SSubheader = styled(ListSubheader)`
    display: flex;
    align-items: center;
    justify-content: space-between;
    line-height: 36px;
    background: ${({ theme }) => theme.palette.background.paper};
`;

const SEmpty = styled('li')`
    padding: ${spacingCss(0.5)} ${spacingCss(2)};
    font-size: 12px;
    color: ${({ theme }) => theme.palette.text.secondary};
`;
