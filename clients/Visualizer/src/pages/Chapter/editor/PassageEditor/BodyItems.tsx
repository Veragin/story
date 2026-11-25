import type { TBodyItemDto } from '@story/protocol';
import { BodyItemEditor } from './BodyItemEditor';
import { replaceAt } from './listUtils';
import { SAddButton } from './styles';
import type { TListProps } from './types';

export const BodyItems = ({
    items,
    onChange,
    diag,
    passageOptions,
    itemOptions,
    passageCreator,
}: TListProps<TBodyItemDto>) => (
    <>
        {items.map((item, i) => (
            <BodyItemEditor
                key={i}
                item={item}
                index={i}
                path={`body.${i}`}
                onChange={(next) => onChange(replaceAt(items, i, next))}
                onRemove={() => onChange(items.filter((_x, j) => j !== i))}
                diag={diag}
                passageOptions={passageOptions}
                itemOptions={itemOptions}
                passageCreator={passageCreator}
            />
        ))}
        <SAddButton
            label={_('Add body item')}
            tone="inherit"
            onClick={() =>
                onChange([
                    ...items,
                    { condition: { code: 'true' }, text: '', links: [] },
                ])
            }
        />
    </>
);
