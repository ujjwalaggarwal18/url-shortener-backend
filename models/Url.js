const mongoose = require('mongoose')

const clickSchema = new mongoose.Schema({
    timestamp: { type: Date, default: Date.now },
    browser: { type: String },
    country: { type: String }
})

const urlSchema = new mongoose.Schema({
    originalUrl: { type: String, required: true, index: true },
    shortCode: { type: String, required: true, unique: true },
    summary: { type: String },
    createdAt: { type: Date, default: Date.now },
    clicks: [clickSchema]
})

module.exports = mongoose.model('Url', urlSchema)