import { Button } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import type { TBodyItemDto } from '@story/visualizer-protocol';
import { BodyItemEditor } from './BodyItemEditor';
import { replaceAt } from './listUtils';
import type { TListProps } from './types';

/** A screen passage's body items and the "Add body item" button. */
export const BodyItems = ({
    items,
    onChange,
    diag,
    passageOptions,
    itemOptions,
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
            />
        ))}
        <Button
            size="small"
            color="inherit"
            startIcon={<AddIcon fontSize="small" />}
            onClick={() =>
                onChange([
                    ...items,
                    { condition: { code: 'true' }, text: '', links: [] },
                ])
            }
            sx={{ alignSelf: 'flex-start' }}
        >
            {_('Add body item')}
        </Button>
    </>
);
