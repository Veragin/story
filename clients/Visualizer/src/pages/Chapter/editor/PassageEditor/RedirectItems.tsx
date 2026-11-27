import type { TRedirectItemDto } from '@story/protocol';
import { RedirectItemEditor } from './RedirectItemEditor';
import { replaceAt } from './listUtils';
import { SAddButton } from './styles';
import type { TListProps } from './types';

export const RedirectItems = ({
    items,
    onChange,
    diag,
    passageOptions,
}: TListProps<TRedirectItemDto>) => (
    <>
        {items.map((item, i) => (
            <RedirectItemEditor
                key={i}
                item={item}
                index={i}
                path={`body.${i}`}
                onChange={(next) => onChange(replaceAt(items, i, next))}
                onRemove={() => onChange(items.filter((_x, j) => j !== i))}
                diag={diag}
                passageOptions={passageOptions}
            />
        ))}
        <SAddButton
            label={_('Add redirect')}
            data-action="add-redirect"
            tone="inherit"
            onClick={() =>
                onChange([
                    ...items,
                    { condition: { code: 'true' }, redirect: '' },
                ])
            }
        />
    </>
);
