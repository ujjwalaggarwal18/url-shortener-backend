const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
require('dotenv').config()
const urlRoutes = require('./routes/url')

const app = express()

// Render puts a proxy in front of the app. Without this, every request
// looks like it comes from the proxy's IP and the rate limiter breaks.
app.set('trust proxy', 1)

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
