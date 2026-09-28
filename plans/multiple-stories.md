see @docs

## Multiple story managment

- we are going to change the story data, plan is to supprot multiple story managment
- story will be hidden under authorization
- support of multi user editation
- will be running on server, drop opening file in vscode funcionality
- add export/import funcionality

### data folder structure

- change the folder structure, at root folder there will be stories folder => story name folder => data and types folder of the story
- move current folder as `example` story
- next to the data and types folder will be story.json file containing information:
    - name
    - author
    - password (SHA2)
    - map size
    - description
    - public (boolean)

### New service LandingPage

- create new FE service that will be as landing page
- it will use Visualiser server as backend
- place the code under Visualiser folder next to the client, server, protocol folders to falder called `landing-page`
- there will be button to create new story => opens modal with form
    - name
    - author name
    - password
    - description
    - map size
- display list of all stories
- for each story display
    - display name
    - author in gray text
    - button to uncollapse description
    - button to edit basic story informations, `Edit` (auth modal)
    - button to open the story in Vsualiser, `Open` (auth modal)
    - button to open story in SingleEngine, `Play as single` (auth modal if not public)
    - export button that will download whole story files as zip (auth modal)
- auth modal means it will ask user for password of the story

### Security

- every endpoint of the visualiser has to be authorized
- once user correctly fill password create session (with 24 hours expiration), set in cookies
- would be best to add authorization to the SingleEngine as well
- dont care about MultiEngine for now, not implemented yet

### Open file

- server will no longer will be running locally
- drop the open in vscode functionality
- instead of the button should open modal and show the whole file content allowing to edit
-
