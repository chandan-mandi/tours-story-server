const express = require("express");
const app = express();
const cors = require("cors");
const port = process.env.PORT || 5000;
const { MongoClient } = require("mongodb");
const ObjectId = require('mongodb').ObjectId;
const admin = require("firebase-admin");
const e = require("express");
require("dotenv").config();


app.use(cors());
app.use(express.json());

if (!admin)
  throw new Error('The FIREBASE_SERVICE_ACCOUNT_CREDS environment variable was not found!');
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.islim.mongodb.net/water-kingdom?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function verifyToken(req, res, next) {
  if (req?.headers?.authorization?.startsWith('Bearer ')) {
    const idToken = req.headers.authorization.split('Bearer ')[1]
    try {
      const decodedUser = await admin.auth().verifyIdToken(idToken)
      req.decodedUserEmail = decodedUser.email
    } catch (error) {
      console.log(error)
    }
  }
  next()
}

async function run() {
  try {
    await client.connect();
    console.log("database connected");
    const database = client.db("tour-story");
    const reviews = database.collection("reviews");
    const usersCollection = database.collection('users');
    const blogsCollection = database.collection("blogs");
    const slideCollection = database.collection("slideses");

    // GET All blog API
    app.get('/blogs', async (req, res) => {
      console.log(req.query);
      const cursor = blogsCollection.find({});
      const page = req.query.page;
      const size = parseInt(req.query.size);
      let blogs;
      const pageCount = await cursor.count();
      if (page) {
        blogs = await cursor.skip(page * size).limit(size).toArray();
      } else {
        blogs = await cursor.toArray();
      }
      res.json({
        pageCount,
        blogs
      });
    });
    // UPDATE SINGLE Blog DETAILS
    app.put('/blog/:id', async (req, res) => {
      const id = req.params.id;
      const updatedBlog = req.body;
      const filter = { _id: ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          title: updatedBlog.title,
          about: updatedBlog.about,
          img: updatedBlog.img,
          category: updatedBlog.category,
          author: updatedBlog.author,
          expense: updatedBlog.expense
        },
      };
      const result = await blogsCollection.updateOne(filter, updateDoc, options)
      res.json(result)
    })
    // UPDATE SINGLE Blog Coment DETAILS
    app.put('/addBlogComment/:id', async (req, res) => {
      const id = req.params.id;
      const updatedBlog = req.body;
      const filter = { _id: ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $push: {
          comments: updatedBlog
        },
      };
      const addComment = await blogsCollection.updateOne(filter, updateDoc, options);
      async function calcAverageRating(ratings) {
        let totalRatings = 0;
        if(ratings){
          ratings.forEach((rating, index) => {
            totalRatings += rating.rating;
          });
          const averageRating = totalRatings / ratings.length;
  
          return averageRating.toFixed(1);
        } else {
          return totalRatings;
        }

      }
      const blog = await blogsCollection.findOne(filter);
      const avgRating = await calcAverageRating(blog.comments)

      const updateDoc2 = {
        $set: {
          rating: avgRating
        },
      };
      const result = await blogsCollection.updateOne(filter, updateDoc2, options)
      res.json(result)
    })
    // DELETE SINGLE BLOG DATA
    app.delete('/blog/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) }
      const result = await blogsCollection.deleteOne(query)
      res.json(result)
    })
    //add blog in database
    app.post('/blogs', async (req, res) => {
      const blog = req.body;
      const result = await blogsCollection.insertOne(blog);
      res.json(result);
    });

    // UPDATE SINGLE Blog Status DETAILS API
    app.patch('/blogs/:id', async (req, res) => {
      const id = req.params.id;
      const updateBlog = req.body;
      const filter = { _id: ObjectId(id) }
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          status: updateBlog.status
        },
      };
      const result = await blogsCollection.updateOne(filter, updateDoc, options)
      res.json(result)
    })
    // GET MY BLOGS
    app.get("/blogs/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (req.decodedUserEmail === email) {
        const query = { authorEmail: email };
        const myBlogs = await blogsCollection.find(query).toArray();
        res.json(myBlogs);
      }
      else {
        res.status(401).json({ message: 'User Not Authorized' });
      }
    });
    // sort blog 
    app.get('/sort-blog', async(req, res) => {
      const cursor = await blogsCollection.find({}).toArray();
      const sortedExpenses = cursor.sort(function (a, b) {
        const intA = parseInt(a.expense)
        const intB = parseInt(b.expense)
        return intA - intB;
      })
      res.json(sortedExpenses)
    })
    // search blog 
    app.get('/search-blogs', async(req, res) => {
      const search = req.query.search;
      const cursor = await blogsCollection.find({}).toArray();
      console.log(cursor);
      if(search){
        const searchResult  = cursor.filter(blog => blog.title.toLocaleLowerCase().includes(search));
        res.send(searchResult)
      } else {
        res.send(cursor)
      }
    })
    // GET APPROVED BLOG
    app.get("/approveBlog", async (req, res) => {
      const statusCheck = { status: "Approved" };
      const cursor = await blogsCollection.find(statusCheck);
      const page = req.query.page;
      const size = parseInt(req.query.size);
      let blogs;
      const pageCount = await cursor.count();
      if (page) {
        blogs = await cursor.skip(page * size).limit(size).toArray();
      } else {
        blogs = await cursor.toArray();
      }
      res.json({
        pageCount,
        blogs
      })
    })
    // SINGLE BLOG FIND
    app.get("/blog/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const blog = await blogsCollection.findOne(query);
      res.json(blog);
    })
    // GET Slides API
    app.get('/slides', async (req, res) => {
      const cursor = slideCollection.find({});
      const users = await cursor.toArray();
      res.json(users);
    });
    // GET Users API
    app.get('/users', async (req, res) => {
      const cursor = usersCollection.find({});
      const users = await cursor.toArray();
      res.json(users);
    });
    //add users in database
    app.post('/users', async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.json(result);
    });
    //update users
    app.put('/users', async (req, res) => {
      const user = req.body;
      const filter = { email: user.email };
      const options = { upsert: true };
      const updateDoc = { $set: user };
      const result = await usersCollection.updateOne(filter, updateDoc, options);
      res.json(result);
    });
    // ADMIN ROLE FINDER from USERSCOLLECTION
    app.get('/users/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      const requester = req.decodedUserEmail;
      console.log('requ', requester)
      if (requester) {
        const requesterAccount = await usersCollection.findOne({ email: requester })
        if (requesterAccount.role === 'admin') {
          const query = { email: email }
          const user = await usersCollection.findOne(query)
          let isAdmin = false;
          if (user?.role === 'admin') {
            isAdmin = true;
          }
          res.json({ admin: isAdmin });
        }
      }
      else {
        res.status(401).json({ message: 'bad request' })
      }
    })
    // ADD ADMIN ROLE 
    app.put('/addAdmin', verifyToken, async (req, res) => {
      const user = req.body;
      console.log('user', user)
      const requester = req.decodedUserEmail;
      if (requester) {
        const requesterAccount = await usersCollection.findOne({ email: requester })
        console.log(requester)
        if (requesterAccount.role === 'admin') {
          const filter = { email: user.email }
          const updateDoc = { $set: { role: 'admin' } }
          const result = await usersCollection.updateOne(filter, updateDoc);
          res.json(result)
        }
      }
      else {
        res.status(403).json({ message: 'You are Not Authorized' })
      }

    })
  } catch (error) {
    //
  }
}

run().catch(console.dir);
app.get("/", async (req, res) => {
  res.send("Water Park Server Running")
})
app.listen(port, () => {
  console.log('Listening the Port', port);
})