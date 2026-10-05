import { observer } from 'mobx-react-lite';
import {
    isCode,
    isValueRecord,
    type TTypeRef,
    type TValue,
} from '@story/visualizer-protocol';
import { ArrayInput } from './ArrayInput';
import { BooleanInput } from './BooleanInput';
import { CodeValue } from './CodeValue';
import { FunctionInput } from './FunctionInput';
import type { TDiagnosticsOf, TInputProps } from './inputTypes';
import { LiteralInput } from './LiteralInput';
import { NumberInput } from './NumberInput';
import { ObjectInput } from './ObjectInput/ObjectInput';
import { StringInput } from './StringInput';
import { useStructureContext } from './structureContext';
import { TypeInput } from './TypeInput';
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
} from './valueSource';

type TProps = TInputProps<TValue> & {
    type: TTypeRef;
    diagnosticsOf?: TDiagnosticsOf;
    hideViewToggle?: boolean;
};

export const ValueInput = observer(
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
                    <StringInput
                        {...input}
                        value={toMaybeCode(value, isString)}
                        onChange={onChange}
                    />
                );
            case 'number':
                return (
                    <NumberInput
                        {...input}
                        value={toMaybeCode(value, isNumber)}
                        onChange={onChange}
                    />
                );
            case 'boolean':
                return (
                    <BooleanInput
                        {...input}
                        value={toMaybeCode(value, isBoolean)}
                        onChange={onChange}
                    />
                );
            case 'literal':
                return (
                    <LiteralInput
                        {...input}
                        value={toMaybeCode(value, isString)}
                        onChange={onChange}
                        options={structure.literalValues(type.name)}
                        onCreateOption={(next) =>
                            structure.addLiteralValue(type.name, next)
                        }
                    />
                );
            case 'ref':
                return (
                    <TypeInput
                        {...input}
                        value={toMaybeCode(value, isString)}
                        onChange={onChange}
                        options={structure.refOptions(type.name)}
                    />
                );
            case 'array':
                return (
                    <ArrayInput
                        {...input}
                        value={toMaybeCode(value, isValueArray)}
                        onChange={onChange}
                        itemType={type.of}
                        diagnosticsOf={diagnosticsOf}
                    />
                );
            case 'object':
                return (
                    <ObjectInput
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
                    <FunctionInput
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
