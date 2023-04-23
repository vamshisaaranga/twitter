const express = require("express");
const app = express();
let db = null;
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const dbPath = path.join(__dirname, "twitterClone.db");
app.use(express.json());
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const InitializeDB = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("SERVER IS RUNNING");
    });
  } catch (e) {
    console.log(`DB ERROR ${e.message}`);
  }
};
InitializeDB();

//api1

app.post("/register/", async (request, response) => {
  const userDetails = request.body;
  const { username, password, name, gender } = userDetails;
  const bcryptPassword = await bcrypt.hash(password, 10);
  const isUniqueUser = `
  SELECT
  *
  FROM
  user
  WHERE
  username = '${username}';`;
  const dbUser = await db.get(isUniqueUser);
  if (dbUser !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too Short");
    } else {
      const addUserQuery = `
        INSERT INTO
        user(name, username, password, gender)
        VALUES
        ('${name}', '${username}', '${bcryptPassword}', '${gender}');`;
      const addUser = await db.run(addUserQuery);
      response.status(200);
      response.send("User created successfully");
    }
  }
});

//login
app.post("/login/", async (request, response) => {
  const loginDetails = request.body;
  const { username, password } = loginDetails;
  const isExistUserQuery = `
    SELECT
    *
    FROM
    user
    WHERE 
    username = '${username}';`;
  const isExistingUser = await db.get(isExistUserQuery);

  if (isExistingUser !== undefined) {
    const isSamePassword = await bcrypt.compare(
      password,
      isExistingUser.password
    );
    if (isSamePassword) {
      const payload = {
        username: username,
        userId: isExistingUser.user_id,
      };
      const jwtToken = jwt.sign(payload, "SECRET CODE");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  } else {
    response.status(400);
    response.send("Invalid user");
  }
});

const authentication = (request, response, next) => {
  let jwtTokenNumber;
  let authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtTokenNumber = authHeader.split(" ")[1];
  }
  if (jwtTokenNumber === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtTokenNumber, "SECRET CODE", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.userId = payload.userId;
        request.username = payload.username;

        next();
      }
    });
  }
};

//API3
app.get("/users/tweets/feed/", authentication, async (request, response) => {
  let { username } = request;
  const latestTweetsQuery = `
    SELECT
    *
    FROM
    (user INNER JOIN follower ON user.user_id = follower.follower_user_id)
    AS t INNER JOIN tweet ON t.following_user_id = tweet.user_id
    WHERE
    user.username = '${username}';`;
  const latestTweets = await db.all(latestTweetsQuery);
  response.send(latestTweets);
});
