/**
 * The location form, shared with the Entities page (WP7):
 *
 *     import { LocationForm } from '../Map/LocationForm';
 *     <LocationForm location={dto} onSave={(patch, version) => api.updateEntity('locations', dto.id, { ...patch, version })} />
 */
export { LocationForm, TextDraftField, type TLocationFormProps } from './LocationForm';
export * from './draft';
