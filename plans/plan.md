# Ai support

- We would like to add Ai agent working in Visualiser
- user can send requests to ai agent running on the server to edit his story lines via user interface in Visualizer
- we have to make sure that user cant edit files that belongs to different story
- we have to track spent tokens for each story

## backend

- user can start ai agent for his story, use claude code cli
- use docker sandbox (https://docs.docker.com/ai/sandboxes/) to limit access of the ai agent => not to reach other stories files
- ai agent will load skills, how to work with the files
- track the token usage and save them in db
- start ai agent when user opens story and there the ai sidebar
- allow user to add commands to it via the user interface
- track and save short session history (user will be able to call /resume to resume the session) - 10 sessions per story
- stop ai session if user leaves the story in Visualizer
- load ai token token from secret file from `/secret/ai_token` saved as txt
- server has to track the process id of teh ai session

## db changes

- add new column in db for story: ai_feature as boolean that will allow the user to use ai
- add new table to db to track ai token spend and the prepaid credits (billing and credits will be implemented later)

## Visualizer ui

- (if ai_feature enabled) in topbar next to the git button add ai togle button, that can open and close ai chat
- ai chat is left sidebar with text area input at bottom, show the chat conversation above
- on top of the sidebar show tittle `Ai agent`, available display credit count
- user can chat with the ai agent running on the server (same as from command line)
- allow to use commads as /clear
- while no credits open left display error message
