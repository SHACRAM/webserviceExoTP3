const z = require("zod");
const  express = require("express")

const { MongoClient, ObjectId } = require("mongodb");

const app = express();
const port = 8000;
const client = new MongoClient("mongodb://localhost:27017");
let db;

app.use(express.json());

const ProductSchema = z.object({
  _id: z.string(),
  name: z.string(),
  about: z.string(),
  price: z.number().positive(),
  categoryIds: z.array(z.string())
});

const CategorySchema = z.object({
  _id: z.string(),
  name: z.string(),
});

const CreateProductSchema = ProductSchema.omit({_id: true});	
const CreateCategorySchema = CategorySchema.omit({ _id: true });


app.post("/products", async (req, res) => {
  const result = await CreateProductSchema.safeParse(req.body);

  if (result.success) {
    const { name, about, price, categoryIds } = result.data;
    const categoryObjectIds = categoryIds.map((id) => new ObjectId(id));

    const ack = await db
      .collection("products")
      .insertOne({ name, about, price, categoryIds: categoryObjectIds });

    res.send({ _id: ack.insertedId, name, about, price, categoryId: categoryObjectIds });
  } else {
    res.status(400).send(result);
  }
});

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
  } catch (error) {
    res.status(400).send({ message: "ID invalide" });
  }
});

app.put("/products/:id", async (req, res) => {
  try {
    const result = CreateProductSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).send(result);
    }

    const { name, about, price, categoryIds } = result.data;
    const categoryObjectIds = categoryIds.map((id) => new ObjectId(id));

    const ack = await db.collection("products").findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      { $set: { name, about, price, categoryIds: categoryObjectIds } },
      { returnDocument: "after" }
    );

    if (!ack) {
      return res.status(404).send({ message: "Produit non trouvé" });
    }
    res.send(ack);
  } catch (error) {
    res.status(400).send({ message: "ID invalide" });
  }
});

app.patch("/products/:id", async (req, res) => {
  try {
    const result = CreateProductSchema.partial().safeParse(req.body);
    if (!result.success) {
      return res.status(400).send(result);
    }

    const updateData = result.data;
    if (Object.keys(updateData).length === 0) {
      return res.status(400).send({ message: "Aucun champ fourni" });
    }

    if (updateData.categoryIds) {
      updateData.categoryIds = updateData.categoryIds.map((id) => new ObjectId(id));
    }

    const ack = await db.collection("products").findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      { $set: updateData },
      { returnDocument: "after" }
    );

    if (!ack) {
      return res.status(404).send({ message: "Produit non trouvé" });
    }
    res.send(ack);
  } catch (error) {
    res.status(400).send({ message: "ID invalide" });
  }
});

app.delete("/products/:id", async (req, res) => {
  try {
    const ack = await db
      .collection("products")
      .findOneAndDelete({ _id: new ObjectId(req.params.id) });

    if (!ack) {
      return res.status(404).send({ message: "Produit non trouvé" });
    }
    res.send(ack);
  } catch (error) {
    res.status(400).send({ message: "ID invalide" });
  }
});


app.post("/categories", async (req, res) => {
  const result = await CreateCategorySchema.safeParse(req.body);

  if (result.success) {
    const { name } = result.data;

    const ack = await db.collection("categories").insertOne({ name });

    res.send({ _id: ack.insertedId, name });
  } else {
    res.status(400).send(result);
  }
});

client.connect().then(() => {
  db = client.db("myDB");
  app.listen(port, () => {
    console.log(`Listening on http://localhost:${port}`);
  });
});
