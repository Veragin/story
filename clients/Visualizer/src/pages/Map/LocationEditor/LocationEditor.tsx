import { observer } from 'mobx-react-lite';
import { isCode, type TLocationDto } from '@story/protocol';
import { FormMaybeCodeTextInput } from '../../../components/code/FormMaybeCodeTextInput';
import { FormArrayEditor } from '../../../components/editors/FormArrayEditor';
import { ConflictAlert } from '../../../components/feedback/ConflictAlert';
import { ErrorAlert } from '../../../components/feedback/ErrorAlert';
import { FormDescriptionInput } from '../../../components/form/FormDescriptionInput';
import { FormFields } from '../../../components/form/FormFields';
import { SidebarHeading } from '../../../components/layout/SidebarHeading';
import { SidebarMeta } from '../../../components/layout/SidebarMeta';
import { LOCAL_CHARACTER_TYPE } from '../../../typeRefs';
import { LocationDetails } from '../LocationDetails';
import type { MapPageStore } from '../MapPageStore';
import { toLocalCharacters } from './draft';
import { LocationToolbar } from './LocationToolbar';
import { useLocationEditor } from './useLocationEditor';

type TProps = {
    store: MapPageStore;
    location: TLocationDto;
    onAddMap: (id: string) => void;
    onDelete: (id: string) => void;
};

export const LocationEditor = observer(
    ({ store, location, onAddMap, onDelete }: TProps) => {
        const editor = useLocationEditor(store, location);
        const { draft, saving } = editor;
        const { name, description } = draft;

        return (
            <>
                <LocationToolbar
                    store={store}
                    locationId={location.id}
                    source={editor}
                    onAddMap={onAddMap}
                    onDelete={onDelete}
                />
                {isCode(name) ? (
                    <SidebarHeading
                        title={store.locationName(location.id)}
                        badge={_('location')}
                    />
                ) : (
                    <SidebarHeading
                        title={name}
                        badge={_('location')}
                        placeholder={location.id}
                        disabled={saving}
                        dataField="name"
                        onTitleChange={(next) => editor.setDraft({ name: next })}
                    />
                )}
                <SidebarMeta values={[location.id, location.file]} />
                {isCode(description) ? (
                    <FormMaybeCodeTextInput
                        label={_('Description')}
                        multiline
                        value={description}
                        onChange={(next = '') =>
                            editor.setDraft({ description: next })
                        }
                        disabled={saving}
                        dataField="description"
                    />
                ) : (
                    <FormDescriptionInput
                        value={description ?? ''}
                        onChange={(next) =>
                            editor.setDraft({ description: next })
                        }
                        disabled={saving}
                        dataField="description"
                    />
                )}
                {editor.conflict && (
                    <ConflictAlert
                        what={_('location')}
                        onReload={() => editor.reloadFromDisk()}
                        onKeepMine={() => editor.keepMine()}
                        disabled={saving}
                    />
                )}
                <ErrorAlert error={editor.error} />
                <FormFields>
                    {isCode(name) && (
                        <FormMaybeCodeTextInput
                            label={_('Name')}
                            value={name}
                            onChange={(next = '') =>
                                editor.setDraft({ name: next })
                            }
                            disabled={saving}
                            dataField="name"
                        />
                    )}
                    <FormArrayEditor
                        label={_('Local characters')}
                        itemType={LOCAL_CHARACTER_TYPE}
                        value={draft.localCharacters}
                        onChange={(items = []) =>
                            editor.setDraft({
                                localCharacters: toLocalCharacters(items),
                            })
                        }
                        disabled={saving}
                        dataField="localCharacters"
                    />
                </FormFields>
                <LocationDetails
                    location={location}
                    sublocationNames={store
                        .childLocationIds(location.id)
                        .map(store.locationName)}
                />
            </>
        );
    }
);
