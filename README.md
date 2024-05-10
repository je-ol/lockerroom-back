### Database schema:
![](https://i.imgur.com/zwRvfq2.png)

The server is hosted on heroku:
https://locker-room-19eb97f5c50f.herokuapp.com/

### Endpoints:
(Not all of them have been implemented)

api/register (GET request, it adds a new member to the database)
- expects a username, email and password

/api/login (POST request to login if you are registered, it gives you a JWT)
- expects an email and password

/api/home (GET request that returns "Welcome + username")
- expects JWT from authorization header

/api/members (GET request that returns the current members and the lobbies they are part of)
- expects JWT from authorization header

/api/all-members (GET request that returns the current member's usernames)
- expects JWT from authorization header

/api/create-lobby (POST request to make a new lobby)
- expects the name of the lobby from the body with the word 'title' ({"title": "example"}), and JWT from authorization header

/api/lobby/:id/add-user (POST request thar add a new member to a lobby, must be admin)
- expects the 'username' of the member from the body ({"username": "example"}), JWT from authorization header, lobby id is given as param

/api/lobby/:id/members (GET request that returns all the member's usernames of a lobby, must be a member of said lobby)
- expects JWT from authorization header, the lobby id is given as a param

/api/lobby/:id (GET request that returns all the messages in a lobby, must be a member)
- expects JWT from authorization header, the lobby id is given as a param

/api/lobby/:id (POST request to send a new message, must be a member)
- expects JWT from authorization header, the lobby id is given as a param, and 'message' from the body ({ "message": "example" })

/api/lobby/:id/:msgId (GET request that returns a single msg from a lobby by using the msg unique id)
- expects JWT from authorization header, lobby id and msg id are given as params

/api/lobbies (GET request that returns all lobbies)
- expects JWT from authorization header

/api/lobby/:id/:msgId (PATCH request to edit a specific msg, must be either the author or be an admin of the server)
- expects 'message' from the body ({ "message": "example"}), JWT from authorization header, lobby id and msg id are given as params