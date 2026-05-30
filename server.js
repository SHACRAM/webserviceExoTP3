const z = require("zod");
const express = require("express");
const { createServer } = require("node:http");
const { Server } = require("socket.io");
const { join } = require("node:path");
const { MongoClient, ObjectId } = require("mongodb");

const app = express();
const server = createServer(app);
const io = new Server(server);

const port = 8000;
const client = new MongoClient("mongodb://localhost:27017");
let db;

app.use(express.json());

app.get("/", (req, res) => {
  res.sendFile(join(__dirname, "index.html"));
});

const ProductSchema = z.object({
  _id: z.string(),
  name: z.string(),
  about: z.string(),
  price: z.number().positive(),
  categoryIds: z.array(z.string()),
});

const CategorySchema = z.object({
  _id: z.string(),
  name: z.string(),
});

const CreateProductSchema = ProductSchema.omit({ _id: true });
const CreateCategorySchema = CategorySchema.omit({ _id: true });

//Products
app.get("/products", async (req, res) => {
  const result = await db
    .collection("products")
    .aggregate([
      { $match: {} },
      {
        $lookup: {
          from: "categories",
          localField: "categoryIds",
          foreignField: "_id",
          as: "categories",
        },
      },
    ])
    .toArray();
  res.send(result);
});

app.get("/products/:id", async (req, res) => {
  try {
    const product = await db
      .collection("products")
      .aggregate([
        { $match: { _id: new ObjectId(req.params.id) } },
        {
          $lookup: {
            from: "categories",
            localField: "categoryIds",
            foreignField: "_id",
            as: "categories",
          },
        },
      ])
      .toArray();

    if (product.length === 0) {
      return res.status(404).send({ message: "Produit non trouvé" });
    }
    res.send(product[0]);
  } catch {
    res.status(400).send({ message: "ID invalide" });
  }
});

app.post("/products", async (req, res) => {
  const result = CreateProductSchema.safeParse(req.body);
  if (!result.success) return res.status(400).send(result);

  const { name, about, price, categoryIds } = result.data;
  const categoryObjectIds = categoryIds.map((id) => new ObjectId(id));

  const ack = await db
    .collection("products")
    .insertOne({ name, about, price, categoryIds: categoryObjectIds });

  const newProduct = { _id: ack.insertedId, name, about, price, categoryIds: categoryObjectIds };

  io.emit("products", { event: "created", product: newProduct });

  res.status(201).send(newProduct);
});

app.put("/products/:id", async (req, res) => {
  try {
    const result = CreateProductSchema.safeParse(req.body);
    if (!result.success) return res.status(400).send(result);

    const { name, about, price, categoryIds } = result.data;
    const categoryObjectIds = categoryIds.map((id) => new ObjectId(id));

    const updated = await db.collection("products").findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      { $set: { name, about, price, categoryIds: categoryObjectIds } },
      { returnDocument: "after" }
    );

    if (!updated) return res.status(404).send({ message: "Produit non trouvé" });

    io.emit("products", { event: "updated", product: updated });

    res.send(updated);
  } catch {
    res.status(400).send({ message: "ID invalide" });
  }
});

app.patch("/products/:id", async (req, res) => {
  try {
    const result = CreateProductSchema.partial().safeParse(req.body);
    if (!result.success) return res.status(400).send(result);

    const updateData = result.data;
    if (Object.keys(updateData).length === 0) {
      return res.status(400).send({ message: "Aucun champ fourni" });
    }
    if (updateData.categoryIds) {
      updateData.categoryIds = updateData.categoryIds.map((id) => new ObjectId(id));
    }

    const updated = await db.collection("products").findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      { $set: updateData },
      { returnDocument: "after" }
    );

    if (!updated) return res.status(404).send({ message: "Produit non trouvé" });

    io.emit("products", { event: "updated", product: updated });

    res.send(updated);
  } catch {
    res.status(400).send({ message: "ID invalide" });
  }
});

app.delete("/products/:id", async (req, res) => {
  try {
    const deleted = await db
      .collection("products")
      .findOneAndDelete({ _id: new ObjectId(req.params.id) });

    if (!deleted) return res.status(404).send({ message: "Produit non trouvé" });

    io.emit("products", { event: "deleted", productId: req.params.id });

    res.send(deleted);
  } catch {
    res.status(400).send({ message: "ID invalide" });
  }
});

//Category
app.post("/categories", async (req, res) => {
  const result = CreateCategorySchema.safeParse(req.body);
  if (!result.success) return res.status(400).send(result);

  const { name } = result.data;
  const ack = await db.collection("categories").insertOne({ name });
  res.send({ _id: ack.insertedId, name });
});

//websocket
io.on("connection", (socket) => {
  console.log("Client connecté:", socket.id);
  socket.on("disconnect", () => console.log("Client déconnecté:", socket.id));
});


client.connect().then(() => {
  db = client.db("myDB");
  server.listen(port, () => { 
    console.log(`Listening on http://localhost:${port}`);
  });
});