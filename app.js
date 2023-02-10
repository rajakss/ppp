const express = require("express");
const path = require("path");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const app = express();
app.use(express.json());
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const bc = require("bcrypt");
const js = require("jsonwebtoken");
let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

const b = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

const c = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const query = `select * from user where username='${username}'`;
  const r = await db.get(query);
  if (r === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const yy = await bc.compare(password, r.password);
    if (yy !== true) {
      response.status(400);
      response.send("Invalid password");
    } else {
      const payload = { username: username };
      const token = await js.sign(payload, "anyone_can_do_anything");
      response.send({ token });
    }
  }
});

const a = (request, response, next) => {
  let jToken;
  const auth = request.headers["authorization"];
  if (auth !== undefined) {
    jToken = auth.split(" ")[1];
  }
  if (jToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    js.verify(jToken, "anyone_can_do_anything", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

app.get("/states/", a, async (request, response) => {
  const query = `
    select * from state`;
  const r = await db.all(query);
  response.send(r.map((i) => b(i)));
});

app.get("/states/:stateId/", a, async (request, response) => {
  const { stateId } = request.params;
  const query = `
    select * from state where state_id=${stateId}`;
  const r = await db.get(query);
  response.send(b(r));
});

app.post("/districts/", a, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const query = `
    insert into district(district_name,state_id,cases,cured,active,deaths)
    values(
        '${districtName}',
         ${stateId},
         ${cases},
         ${cured},
         ${active},
         ${deaths}
    );`;
  await db.run(query);
  response.send("District Successfully Added");
});

app.get("/districts/:districtId/", a, async (request, response) => {
  const { districtId } = request.params;
  const query = `
    select * from district where district_id=${districtId}`;
  const r = await db.get(query);
  response.send(c(r));
});

app.delete("/districts/:districtId/", a, async (request, response) => {
  const { districtId } = request.params;
  const query = `delete from district where district_id=${districtId}`;
  await db.run(query);
  response.send("District Removed");
});

app.put("/districts/:districtId/", async (request, response) => {
  const { districtId } = request.params;
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const query = `
    update district
    set
    district_name='${districtName}',
    state_id=${stateId},
    cases=${cases},
    cured=${cured},
    active=${active},
    deaths=${deaths}`;
  await db.run(query);
  response.send("District Details Updated");
});

app.get("/states/:stateId/stats/", a, async (request, response) => {
  const { stateId } = request.params;
  const query = `select
    SUM(cases),
    SUM(cured),
    SUM(active),
    SUM(deaths)
    from 
        district
    where state_id=${stateId};`;
  const stats = await db.get(query);
  response.send({
    totalCases: stats["SUM(cases)"],
    totalCured: stats["SUM(cured)"],
    totalActive: stats["SUM(active)"],
    totalDeaths: stats["SUM(deaths)"],
  });
});

module.exports = app;
