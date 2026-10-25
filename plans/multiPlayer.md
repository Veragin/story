# implement MultiPlayer

- rename @clients/MultiEngine to MultiPlayer
- this service should allow the users to play the story together
- every player plays for different character

## StoryRoomManager

- create new StoryRoomManager module that will handle rooms to play the story
- there is possible to create new room or join already existing not started one
- joining the room will put player into a loby
- started rooms cant be joined
- empty room can be deleted by anyone
- on room creation, player automatically enters the room
- maximum player count defined by story character count

## Loby

- voice chat
- in loby display Landing image on the background
- player can pick (unique) character he wants to play
- player can mark as ready => if all players are ready the story is started

## Server module

- whole story state is handled on the server side
- its multiplayer (if less players than characters, played by automode)
- story files are kept and provided by our server (load only passages that are needed)
- only public stories can be played (or you have to authorize to play private story)
- use same endpoints if possible that are for SinglePlayer
-

## UI

- display room, and players there, is there voice chat, every player can pick unique character
- add mute button on/off
- player can click ready => once everyone is ready the game starts

## Voice chat

- used for players to comunicate
- copy the implementation from botc project
- available in Loby, all players together in one global voice chat (no private calls)
- we are going to implement the configuration for the story that will define when players can speak to each other
- example:
    - players on same location will join the location voice chat
    - character in rthe story can have phone => is able to call other character (player)
