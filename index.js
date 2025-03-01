require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express')
const cors = require('cors')
const app = express()
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 4500
app.use(express.json())
app.use(cors())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.3t5vk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
   const menuCollection =client.db('BistroDb').collection('menu')
    const cartCollection = client.db('BistroDb').collection('carts')
    const usersCollection = client.db('BistroDb').collection('users')
    const paymentsCollection = client.db('BistroDb').collection('payments')

app.get('/jwt',(req,res)=>{
const userData = req.body
const token = jwt.sign(userData,process.env.ACCESS_TOKEN,{expiresIn:'7day'})
return res.send({token})
})
const verifyToken=(req,res,next)=>{
 const token= req.headers.authorization.split(' ')[1]

  
  if(!token){
    return res.status(401).send('unauthorized access')
  }
  jwt.verify(token,process.env.ACCESS_TOKEN,(err,decoded)=>{
    if(err){
      return res.status(401).send('unauthorized access')
    }
    req.decoded = decoded
    next()
  })
}
// users related apis
app.get('/users',verifyToken, async(req,res)=>{
  
  const result = await usersCollection.find().toArray()
  res.send(result)
})
app.patch('/user/admin/:id',verifyToken ,async(req,res)=>{
  const id = req.params.id
  const filter = {_id: new ObjectId(id)}
  const updateDoc ={
    $set:{
      role:'admin'
    }
  }
  const result = await usersCollection.updateOne(filter,updateDoc)
  res.send(result)
})
app.get('/user/isAdmin/:email',async(req,res)=>{
const email = req.params.email
const query = {email:email}
let admin = false
const isAdmin= await usersCollection.findOne(query)
if(isAdmin?.role ==='admin'){
  admin = true
}
res.send({admin})
})
app.delete('/user/:id',verifyToken, async(req,res)=>{
  const id = req.params.id
  const query = {_id: new ObjectId(id)}
  const result = await usersCollection.deleteOne(query)
  res.send(result)
})
app.post('/users',async(req,res)=>{
  const userData = req.body
  const email = req.body.email 
  const query = {email}
  const isExist =await usersCollection.findOne(query)
  if(isExist){
    return res.send('already email exist')
  }
  const result = await usersCollection.insertOne(userData)
  res.send(result)
})
app.get('/menu',async(req,res)=>{
const result = await menuCollection.find().toArray()
res.send(result)
})
app.post('/menu',async(req,res)=>{
  const menuData =req.body
  const result = await menuCollection.insertOne(menuData)
  res.send(result)
})
app.delete('/menu/:id',async(req,res)=>{
  const id = req.params.id
  const query ={_id: id}
  const result = await menuCollection.deleteOne(query)

  res.send(result)
})
// carts apis 
app.post('/carts',async(req,res)=>{
const cartItem = req.body 
const result = await cartCollection.insertOne(cartItem)
res.send(result)

})
app.get('/carts',async(req,res)=>{
  const email = req.query.email
  const query = {email:email}
  const result = await cartCollection.find(query).toArray()
  res.send(result)
})
app.delete('/carts/:id',async(req,res)=>{
  const id = req.params.id
  const query = {_id: new ObjectId(id)}
  const result = await cartCollection.deleteOne(query)
  res.send(result)
})
// payment related api
app.post('/create-payment',async(req,res)=>{
  const {price} = req.body
  const amount = parseInt(price *  100)
  
  const paymentInt = await stripe.paymentIntents.create({
    amount:amount,
    currency:'usd',
    payment_method_types:["card"]
  })
  res.send({
    clientSecret: paymentInt.client_secret,
  })
})
app.post('/payments',async(req,res)=>{
const payment = req.body 

const query={_id: {
  $in:payment.cartId.map(id=> new ObjectId(id))
}}
const deleteData= await cartCollection.deleteMany(query)

const result = await paymentsCollection.insertOne(payment)
res.send({deleteData,result})
})
app.get('/history/:email',async(req,res)=>{
  const query = {email: req.params.email}
  const result = await paymentsCollection.find(query).toArray()
  res.send(result)
})
app.get('/admin-stat',async(req,res)=>{
  const usersCount = await usersCollection.estimatedDocumentCount()
  const menuCount = await menuCollection.estimatedDocumentCount()
  const result =await  paymentsCollection.aggregate([
    {
      $group:{
        _id:null,
        totalMoney:{
          $sum:"$totalPrice"
        }


      }
    }
  ]).toArray()
  const totalIncome = result.length>0 ? result[0].totalMoney:0;
  const orderCount = await paymentsCollection.estimatedDocumentCount()
  res.send({
    usersCount,
    menuCount,
    orderCount,
    totalIncome
  })
})
app.get('/admin-chart',async(req,res)=>{
  const result = await paymentsCollection.aggregate([
    {
      $unwind:"$menuId"
    },
    {
      $lookup:{
        from:'menu',
        localField:'menuId',
        foreignField:"_id",
        as: "menuItems"
      }
    },
    {
      $unwind:'$menuItems'
    },
    {
      $group:{
        _id:"$menuItems.category",
        quantity:{$sum:1},
        revenue:{$sum:'$menuItems.price'}
      }
    },
    {
      $project:{
        _id:0,
        category:"$_id",
         quantity: '$quantity',
            revenue: '$revenue'
      }
    }
  ]).toArray()
 res.send(result)
})
    // await client.connect();
    // // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
 
  }
}
run().catch(console.dir);



app.get('/',(req,res)=>{
    res.send('bistro boss server is running')
})

app.listen(port, ()=>{
  console.log(`server is running on ${port}`)  
})