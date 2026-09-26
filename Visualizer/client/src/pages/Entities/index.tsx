import { PagePlaceholder, TEntityKind } from '../../shell';

type Props = {
    kind?: TEntityKind;
    id?: string;
};

/**
 * Entities page (`#/entities`, `#/entities/:kind`, `#/entities/:kind/:id`). Placeholder; WP7
 * adds the kind menu, the entity list and the forms.
 */
export default function EntitiesPage({ kind, id }: Props) {
    return (
        <PagePlaceholder title={_('Entities')}>
            {kind && <div>{id ? `${kind} / ${id}` : kind}</div>}
            <div>{_('Coming soon.')}</div>
        </PagePlaceholder>
    );
}
