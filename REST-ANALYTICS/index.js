const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const z = require("zod");

const app = express();
const port = 8001;
const client = new MongoClient("mongodb://localhost:27017");
let db;

app.use(express.json());

const ViewSchema = z.object({
  source: z.string(),
  url: z.string(),
  visitor: z.string(),
  createdAt: z.coerce.date().optional().default(() => new Date()),
  meta: z.record(z.any()).optional().default({}),
});

const ActionSchema = z.object({
  source: z.string(),
  url: z.string(),
  action: z.string(),
  visitor: z.string(),
  createdAt: z.coerce.date().optional().default(() => new Date()),
});

const GoalSchema = z.object({
  source: z.string(),
  url: z.string(),
  goal: z.string(),
  visitor: z.string(),
  createdAt: z.coerce.date().optional().default(() => new Date()),
  meta: z.record(z.any()).optional().default({}),
});

//views
app.post("/views", async (req, res) => {
  try {
    const result = ViewSchema.safeParse(req.body);
    if (!result.success) return res.status(400).send(result);

    const ack = await db.collection("views").insertOne(result.data);
    res.status(201).send({ _id: ack.insertedId, ...result.data });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Erreur serveur" });
  }
});

app.get("/views", async (req, res) => {
  try {
    const views = await db.collection("views").find().toArray();
    res.send(views);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Erreur serveur" });
  }
});

//actions
app.post("/actions", async (req, res) => {
  try {
    const result = ActionSchema.safeParse(req.body);
    if (!result.success) return res.status(400).send(result);

    const ack = await db.collection("actions").insertOne(result.data);
    res.status(201).send({ _id: ack.insertedId, ...result.data });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Erreur serveur" });
  }
});

app.get("/actions", async (req, res) => {
  try {
    const actions = await db.collection("actions").find().toArray();
    res.send(actions);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Erreur serveur" });
  }
});

//goals
app.post("/goals", async (req, res) => {
  try {
    const result = GoalSchema.safeParse(req.body);
    if (!result.success) return res.status(400).send(result);

    const ack = await db.collection("goals").insertOne(result.data);
    res.status(201).send({ _id: ack.insertedId, ...result.data });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Erreur serveur" });
  }
});

app.get("/goals", async (req, res) => {
  try {
    const goals = await db.collection("goals").find().toArray();
    res.send(goals);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Erreur serveur" });
  }
});

app.get("/goals/:goalId/details", async (req, res) => {
  try {
    const goal = await db.collection("goals").findOne({ _id: new ObjectId(req.params.goalId) });

    if (!goal) return res.status(404).send({ message: "Goal non trouvé" });

    const views = await db.collection("views").find({ visitor: goal.visitor }).toArray();
    const actions = await db.collection("actions").find({ visitor: goal.visitor }).toArray();

    res.send({ goal, visitor: goal.visitor, views, actions });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Erreur serveur" });
  }
});

client.connect().then(() => {
  db = client.db("analyticsDB");
  app.listen(port, () => {
    console.log(`Listening on http://localhost:${port}`);
  });
});