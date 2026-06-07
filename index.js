const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
require('dotenv').config()
const urlRoutes = require('./routes/url')

const app = express()

app.use(cors({
    origin: 'https://url-shortener-frontend-ten-chi.vercel.app'
}))

app.use(express.json())

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB connected'))
    .catch((err) => console.log('DB connection error:', err))

app.use('/', urlRoutes)

app.listen(process.env.PORT, () => {
    console.log(`Server running on port ${process.env.PORT}`)
})
