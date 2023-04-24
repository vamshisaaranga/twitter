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
      response.send("Password is too short");
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
  const userIdQuery = `
  SELECT
  *
  FROM
  user
  WHERE
  username = '${username}';`;
  const loggedInUserID = await db.get(userIdQuery);
  const loggedUserId = loggedInUserID.user_id;
  const latestTweetsQuery = `
    SELECT
    user.username,
    tweet.tweet,
    tweet.date_time AS dateTime
    FROM
    (follower INNER JOIN tweet ON follower.following_user_id = tweet.user_id)
    as t INNER JOIN user ON t.user_id = user.user_id
    WHERE
    follower.follower_user_id = '${loggedUserId}'
    ORDER BY 
    tweet.date_time DESC
    LIMIT 4;`;

  const latestTweets = await db.all(latestTweetsQuery);
  response.send(latestTweets);
});

//api4

app.get("/user/following/", authentication, async (request, response) => {
  let { username } = request;
  const userIdQuery = `
  SELECT
  *
  FROM
  user
  WHERE
  username = '${username}';`;
  const loggedInUserID = await db.get(userIdQuery);
  const loggedUserId = loggedInUserID.user_id;
  console.log(loggedUserId);
  const sqlQuery = `
    SELECT
    user.name
    FROM
    user INNER JOIN follower ON follower.following_user_id = user.user_id
    WHERE
    follower.follower_user_id = ${loggedUserId}`;
  const getFollowerNames = await db.all(sqlQuery);
  response.send(getFollowerNames);
});

//api5
app.get("/user/followers/", authentication, async (request, response) => {
  let { username } = request;
  const userIdQuery = `
  SELECT
  *
  FROM
  user
  WHERE
  username = '${username}';`;
  const loggedInUserID = await db.get(userIdQuery);
  const loggedUserId = loggedInUserID.user_id;
  const sqlQuery = `
  SELECT
   user.name
   FROM
   user INNER JOIN follower ON user.user_id = follower.follower_user_id
   WHERE
   follower.following_user_id = ${loggedUserId};`;
  const getQuery = await db.all(sqlQuery);
  response.send(getQuery);
});

//api6
app.get("/tweets/:tweetId/", authentication, async (request, response) => {
  let { username } = request;
  const { tweetId } = request.params;
  const userIdQuery = `
  SELECT
  *
  FROM
  user
  WHERE
  username = '${username}';`;
  const loggedInUserID = await db.get(userIdQuery);
  const loggedUserId = loggedInUserID.user_id;
  console.log(loggedUserId);
  const wetherUserFollowQuery = `
  SELECT
  *
  FROM
  follower INNER JOIN tweet ON follower.following_user_id = tweet.user_id
  WHERE
  follower.follower_user_id = ${loggedUserId}`;
  const userFollowsTweets = await db.all(wetherUserFollowQuery);

  let userFollowsTweetIds = [];
  for (eachTweet of userFollowsTweets) {
    userFollowsTweetIds.push(`${eachTweet.tweet_id}`);
  }
  isTweetIncludes = userFollowsTweetIds.includes(tweetId);
  if (isTweetIncludes) {
    const tweetDetailsQuery = `
     SELECT
      COUNT() as likes,
      tweet.tweet,
      tweet.date_time as dateTime
     FROM
     tweet INNER JOIN like ON tweet.tweet_id = like.tweet_id
     WHERE
     tweet.tweet_id = ${tweetId}
     GROUP BY
     tweet.tweet_id;`;
    const totalLikeForTweet = await db.all(tweetDetailsQuery);

    const replaycountQuery = `
    SELECT
    COUNT() AS replay
    FROM
    tweet INNER JOIN reply ON tweet.tweet_id = reply.tweet_id
    WHERE
    tweet.tweet_id = ${tweetId}
    GROUP By
    tweet.tweet_id;`;
    const replyCount = await db.all(replaycountQuery);
    response.send({
      tweet: totalLikeForTweet[0].tweet,
      likes: totalLikeForTweet[0].likes,
      replies: replyCount[0].replay,
      dateTime: totalLikeForTweet[0].dateTime,
    });
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

//api7

app.get(
  "/tweets/:tweetId/likes/",
  authentication,
  async (request, response) => {
    let { username } = request;
    const { tweetId } = request.params;
    const userIdQuery = `
  SELECT
  *
  FROM
  user
  WHERE
  username = '${username}';`;
    const loggedInUserID = await db.get(userIdQuery);
    const loggedUserId = loggedInUserID.user_id;
    const wetherUserFollowQuery = `
  SELECT
  *
  FROM
  follower INNER JOIN tweet ON follower.following_user_id = tweet.user_id
  WHERE
  follower.follower_user_id = ${loggedUserId}`;
    const userFollowsTweets = await db.all(wetherUserFollowQuery);

    let userFollowsTweetIds = [];
    for (eachTweet of userFollowsTweets) {
      userFollowsTweetIds.push(`${eachTweet.tweet_id}`);
    }
    isTweetIncludes = userFollowsTweetIds.includes(tweetId);
    if (isTweetIncludes) {
      const userNamesQuery = `
      SELECT
      *
      FROM
      user INNER JOIN like ON user.user_id = like.user_id
      WHERE
      like.tweet_id = ${tweetId};`;
      const userNames = await db.all(userNamesQuery);
      let likedUserList = [];
      for (eachUser of userNames) {
        likedUserList.push(eachUser.username);
      }
      response.send({
        likes: likedUserList,
      });
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

//api8
app.get(
  "/tweets/:tweetId/replies/",
  authentication,
  async (request, response) => {
    let { username } = request;
    const { tweetId } = request.params;
    const userIdQuery = `
  SELECT
  *
  FROM
  user
  WHERE
  username = '${username}';`;
    const loggedInUserID = await db.get(userIdQuery);
    const loggedUserId = loggedInUserID.user_id;
    const wetherUserFollowQuery = `
  SELECT
  *
  FROM
  follower INNER JOIN tweet ON follower.following_user_id = tweet.user_id
  WHERE
  follower.follower_user_id = ${loggedUserId}`;
    const userFollowsTweets = await db.all(wetherUserFollowQuery);

    let userFollowsTweetIds = [];
    for (eachTweet of userFollowsTweets) {
      userFollowsTweetIds.push(`${eachTweet.tweet_id}`);
    }
    isTweetIncludes = userFollowsTweetIds.includes(tweetId);
    if (isTweetIncludes) {
      const sqlQuery = `
        SELECT
        *
        FROM
        user INNER JOIN reply ON user.user_id = reply.user_id
        WHERE
        reply.tweet_id = ${tweetId};`;
      const replies = await db.all(sqlQuery);
      let repliesList = [];
      for (eachReply of replies) {
        repliesList.push({
          name: eachReply.name,
          reply: eachReply.reply,
        });
      }
      response.send({
        replies: repliesList,
      });
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

//api9
app.get("/user/tweets/", authentication, async (request, response) => {
  let { username } = request;
  const userIdQuery = `
  SELECT
  *
  FROM
  user
  WHERE
  username = '${username}';`;
  const loggedInUserID = await db.get(userIdQuery);
  const loggedUserId = loggedInUserID.user_id;
  const tweetsOfUser = `
    SELECT
     tweet.tweet,
     COUNT(tweet.tweet_id) AS likes,
     COUNT(reply.reply_id) AS replies,
     tweet.date_time as dateTime
     FROM
     (like INNER JOIN tweet ON like.tweet_id = tweet.tweet_id)
     AS t INNER JOIN reply ON t.tweet_id = reply.tweet_id
     WHERE
     like.user_id = ${loggedUserId}
     GROUP BY
     tweet.tweet_id,
     reply.reply_id;`;
  const tweets = await db.all(tweetsOfUser);
  response.send(tweets);
});

//api10
app.post("/user/tweets/", authentication, async (request, response) => {
  const newTwit = request.body;
  const { twit } = newTwit;
  const createTwitQuery = `
     INSERT INTO
     tweet(tweet)
     VALUES('${twit}');`;
  const createTwit = await db.run(createTwitQuery);
  response.send("Created a Tweet");
});

//api11
app.delete("/tweets/:tweetId/", authentication, async (request, response) => {
  let { username } = request;
  const { tweetId } = request.params;
  const userIdQuery = `
  SELECT
  *
  FROM
  user
  WHERE
  username = '${username}';`;
  const loggedInUserID = await db.get(userIdQuery);
  const loggedUserId = loggedInUserID.user_id;
  const wetherUserTweets = `
  SELECT
  *
  FROM
  tweet
  WHERE
  tweet.user_id = ${loggedUserId}`;
  const userFollowsTweets = await db.all(wetherUse);

  let userFollowsTweetIds = [];
  for (eachTweet of userFollowsTweets) {
    userFollowsTweetIds.push(`${eachTweet.tweet_id}`);
  }
  isTweetIncludes = userFollowsTweetIds.includes(tweetId);
  if (isTweetIncludes) {
    const deleteQuery = `
      DELETE FROM
      tweet
      WHERE 
      tweet_id = ${tweetId};`;
    const deleteTweet = await db.run(deleteQuery);
    response.send("Tweet Removed");
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

module.exports = app;
