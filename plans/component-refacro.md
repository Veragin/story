## inputs

- create new folder @Visualliser/client/src/components/inputs
- move there all input components
- pure input components will be without label
- create folder `form` inside `inputs`
- each pure component will have form variation eg. `BooleanInput.ts` will have `FormBooleanInput.ts` that will add label to it (create `FormLabel` that will wrap it and diplsay label)
- FormLabel will display label next to the input (on smaller space put label above the input with small font as its now)
- as we have FunctionInput, there should be
    - BooleanInput - checkbox
    - StringInput
        - single (input:text) / multiline (textarea) prop
    - NumberInput
    - ObjectInput { key: value }
        - toggle that can switch between code and input view
        - user can set is as plain code, add validation
        - in input view display list of all fields as inputs
        - can have defined structure (which keys has which value type)
        - if no structure defined => add possibility to add custom filed
            - string key, user defines the type
        - support optional type
        - support boolean, string, number, functions, arrays, objects
    - ArrayInput []
        - possible to add, move and remove items from the array
        - can have defined item structure
    - LiteralInput
        - select from gine literal
        - use Autocomplete from MUI
    - TypeInput
        - select entity based on given type based on name
        - use Autocomplete from MUI
    - StructureInput
        - used in Structure tab
        - add remove structure
        - select strucutre: eg TCharacter will have property `race: TRace` => character entity now has to pick race as one from Race entities
- for inputs dont support modifiy as code (except Object input)
- use the input components everywhere in Visualiser (eg. in Entities => charachters => data type CharacterData should be ObjectInput)

## Structure

- we would like to implement Strucutre tab
- here user can define structures as `types` and `literals`, that will be used in the story
- for every new `type` create separete file in @types folder of story
- all literals move to one file `literals.ts`
- literal: eg. `TItemType = 'tool' | 'weapon' | 'resource`
- type: eg. `TLocation = { id: string; ... }`
    - eg user can change the TCharacterData, add `energy: number`
- consider different type file structure if needed
    - split TNpc to separate file
- user can add new type, eg: `TRace` and than create instance of it in Entities
- create robust solution

## Suggestions

- create store that will handle available types and literals eg. StructureStore
- create store that will handle entities eg. EntityStore
