## server refactor

- large refactor of the server implementation
- create new folder server in root folder
- will contain whole server implementation

## Folder Structure

- stories
    - hold stories data (remain the same)
- docker
    - contains docker setup
    - if possible move there docker-compose

* server
    - will contain whole server implementation
* docs
    - holds documentation
* clients
    - the FE implementation of services (splited into folders):
    - Visualiser
    - SingleEngine
    - MultiEngine
    - shared - shared code
* protocol
    - holds interface that you can comunicate with the server
    - paths + required body types

## Server Implementation

- there will be only one server handling all clients (Visualiser, SingleEngine, MultipleEngine)
- MultipleEngine will be implemented in the future, dont care about it now
- it should serve story data to clients
- implement the server of @Visualizer/server
- create typescript nestjs server, split the code into modules, based on funcionality
- implement proper authorization
    - read - provide files for read if the story is public
    - write - require password to authorize, create session

- setup mysql server => store basic story (now in sotry.json) data in the database
- use typeorm to comunicate with the db, create db tables migration process
