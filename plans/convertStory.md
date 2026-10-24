# Engine settings

- user will be able to modifiy how the engine (that is playing the game works)
- create new tab in Visualiser called Engine
- display the same left menu (as in Structures) with 2 item `onLinkClick`, `topbar`
- `onLinkClick` is a function (get clicked link data) thats executed when user clicks on a link
- `topbar` user can change the topbar
- eg. user wants to define new mechanic, that spending time will increase the hunger of the character => can defined function taht will subtract character hunger value based on link time

# convert demo story and add it

- see @tmp/demo-story, its a story written in the old format, convert it as a new `demo` story under the stories so its playable
- it sends hunger and energy on time progress, use `onLinkClick`
- display in topbar energy and hunger ad icon and number
