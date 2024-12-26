const express = require('express');
const bcrypt = require('bcrypt');
const {open} = require('sqlite');
const sqlite3 = require('sqlite3');
const jwt = require('jsonwebtoken')
const path = require('path');
const dbPath = path.join(__dirname, 'task.db');
const cors = require('cors');
const { parse, format, parseISO} = require('date-fns');

const app = express();
app.use(express.json());
app.use(cors());

let db = null;

const initializeDbServer = async() => {
    try {
        db = await open({
            filename: dbPath,
            driver: sqlite3.Database
        })
        app.listen(3000, () => {
            console.log("server run at 3000 port");
        })
    }catch(e) {
        console.log(`DB error: ${e.message}`);
        process.exit(1);
    }
}

initializeDbServer();

app.post("/users", async (request, response) => {
    const { id, username, name, gender, location } = request.body;
    const hashedPassword = await bcrypt.hash(request.body.password, 10);
    const selectUserQuery = `SELECT * FROM users WHERE username = '${username}'`;
    const dbUser = await db.get(selectUserQuery);
    if (dbUser === undefined) {
      const createUserQuery = `
        INSERT INTO 
          users (id, username, name, password, gender, location) 
        VALUES 
          (
            '${id}',
            '${username}', 
            '${name}',
            '${hashedPassword}', 
            '${gender}',
            '${location}'
          )`;
      const dbResponse = await db.run(createUserQuery);
      const newUserId = dbResponse.lastID;
      response.send(`Created new user with ${newUserId}`);
    } else {
      response.status = 400;
      response.send("User already exists");
    }
});

app.post("/login", async (request, response) => {
    const { username, password } = request.body;
    const selectUserQuery = `SELECT * FROM users WHERE username = '${username}'`;
    const dbUser = await db.get(selectUserQuery);
    if (dbUser === undefined) {
      response.status(400);
      response.send("Invalid User");
    } else {
      const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
      if (isPasswordMatched === true) {
        const payload = {
          username: username,
        };
        const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
        response.send({ jwtToken });
      } else {
        response.status(400);
        response.send("Invalid Password");
      }
    }
});

const authenticateToken = (request, response, next) => {
    let jwtToken;
    const authHeader = request.headers["authorization"];
    if (authHeader !== undefined) {
      jwtToken = authHeader.split(" ")[1];
    }
    if (jwtToken === undefined) {
      response.status(401);
      response.send("Invalid JWT Token");
    } else {
      jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
        if (error) {
          response.status(401);
          response.send("Invalid JWT Token");
        } else {
          next();
        }
      });
    }
};

// get tasks list

app.get("/task", authenticateToken, async (request, response) => {
    try {
        const getTasksQuery = `SELECT * FROM task ORDER BY taskname;`;
        const getTasksArray = await db.all(getTasksQuery);
        response.send(getTasksArray);
    }catch(e) {
        console.log(`error: ${e.message}`);
    }
})

app.post("/task", authenticateToken, async (request, response) => {
    try {
        const {id, taskName, description, dueDate, status, priority} = request.body;
        const formattedDate = format(parse(dueDate, "dd-MM-yyyy", new Date()), "yyyy-MM-dd");
        const addTaskQuery = `
            INSERT INTO 
                task (id, taskName, description, dueDate, status, priority)
            VALUES 
                (
                    '${id}',
                    '${taskName}',
                    '${description}',
                    ${formattedDate},
                    '${status}',
                    '${priority}'
        );`;
        await db.run(addTaskQuery);
        response.send("task added successfully");
    }catch(e) {
        console.log(`error: ${e.message}`);
    }
})

app.patch("/task/:taskId/", authenticateToken, async (request, response) => {
  try {
      const {taskId} = request.params
      const {id, taskName, description, dueDate, status, priority} = request.body;
      const formattedDate = format(parse(dueDate, "dd-MM-yyyy", new Date()), "yyyy-MM-dd");
      const updateTaskQuery = `
          UPDATE
            task
          SET
            id = '${id}',
            taskName = '${taskName}',
            description = '${description}',
            dueDate = ${formattedDate},
            status  = '${status}',
            priority = '${priority}'
          `;
      await db.run(updateTaskQuery);
      response.send("task updated successfully");
  }catch(e) {
      console.log(`error: ${e.message}`);
  }
})

app.delete("/task/:taskId", authenticateToken, async(request, response) => {
  try {
    const {taskId} = request.params;
    const deleteTaskQuery = `DELETE FROM task Where id = ${taskId};`;
    await db.run(deleteTaskQuery);
    response.send("delete task successfully")
  }catch(e) {
    console.log(`error: ${e.message}`);
  }
})

module.exports = app;
