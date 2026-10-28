import { observer } from 'mobx-react-lite';
import {
    isCode,
    isValueRecord,
    type TTypeRef,
    type TValue,
} from '@story/protocol';
import { ArrayEditor } from './ArrayEditor';
import { CodeValue } from '../code/CodeValue';
import { MaybeCodeAutocompleteInput } from '../code/MaybeCodeAutocompleteInput';
import { MaybeCodeCheckbox } from '../code/MaybeCodeCheckbox';
import { MaybeCodeNumberInput } from '../code/MaybeCodeNumberInput';
import { MaybeCodeTextInput } from '../code/MaybeCodeTextInput';
import { FunctionEditor } from './FunctionEditor';
import type { TDiagnosticsOf, TInputProps } from '../inputs/inputTypes';
import { ObjectEditor } from './ObjectEditor/ObjectEditor';
import { optionsOf } from '../../structure/option';
import { useStructureContext } from '../../structure/structureContext';
import {
    functionToValue,
    isBoolean,
    isNumber,
    isString,
    isValueArray,
    parsePlainValue,
    toFunctionDto,
    toMaybeCode,
    valueToSource,
} from '../../values/valueSource';

type TProps = TInputProps<TValue> & {
    type: TTypeRef;
    diagnosticsOf?: TDiagnosticsOf;
    hideViewToggle?: boolean;
};

export const ValueEditor = observer(
    ({
        type,
        value,
        onChange,
        diagnosticsOf,
        hideViewToggle,
        ...input
    }: TProps) => {
        const structure = useStructureContext();
        switch (type.t) {
            case 'string':
                return (
                    <MaybeCodeTextInput
                        {...input}
                        value={toMaybeCode(value, isString)}
                        onChange={onChange}
                    />
                );
            case 'number':
                return (
                    <MaybeCodeNumberInput
                        {...input}
                        value={toMaybeCode(value, isNumber)}
                        onChange={onChange}
                    />
                );
            case 'boolean':
                return (
                    <MaybeCodeCheckbox
                        {...input}
                        value={toMaybeCode(value, isBoolean)}
                        onChange={onChange}
                    />
                );
            case 'literal':
                return (
                    <MaybeCodeAutocompleteInput
                        {...input}
                        value={toMaybeCode(value, isString)}
                        onChange={onChange}
                        options={optionsOf(structure.literalValues(type.name))}
                        onCreateOption={(next) =>
                            structure.addLiteralValue(type.name, next)
                        }
                    />
                );
            case 'ref':
                return (
                    <MaybeCodeAutocompleteInput
                        {...input}
                        value={toMaybeCode(value, isString)}
                        onChange={onChange}
                        options={structure.refOptions(type.name)}
                    />
                );
            case 'array':
                return (
                    <ArrayEditor
                        {...input}
                        value={toMaybeCode(value, isValueArray)}
                        onChange={onChange}
                        itemType={type.of}
                        diagnosticsOf={diagnosticsOf}
                    />
                );
            case 'object':
                return (
                    <ObjectEditor
                        {...input}
                        value={toMaybeCode(value, isValueRecord)}
                        onChange={onChange}
                        fields={type.fields}
                        diagnosticsOf={diagnosticsOf}
                        hideViewToggle={hideViewToggle}
                    />
                );
            case 'function':
                return (
                    <FunctionEditor
                        {...input}
                        value={toFunctionDto(value)}
                        onChange={(next) => onChange(functionToValue(next))}
                    />
                );
            case 'code':
                return (
                    <CodeValue
                        {...input}
                        code={isCode(value) ? value.code : valueToSource(value)}
                        parse={parsePlainValue}
                        onChange={onChange}
                    />
                );
        }
    }
);
