const express = require('express')
const router = express.Router()
const { nanoid } = require('nanoid')
const Url = require('../models/Url')
const { GoogleGenerativeAI } = require('@google/generative-ai')

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

const summarizeUrl = async (url) => {
    try {
        console.log('Calling Gemini for:', url)
        console.log('API Key exists:', !!process.env.GEMINI_API_KEY)
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
        const prompt = `In 2-3 sentences, describe what this URL is likely about based on its address. Be concise and informative. URL: ${url}`
        const result = await model.generateContent(prompt)
        const summary = result.response.text()
        console.log('Summary generated:', summary)
        return summary
    } catch (err) {
        console.log('Gemini error:', err.message)
        return 'Summary unavailable.'
    }
}

// POST /shorten — create a short URL
router.post('/shorten', async (req, res) => {
    const { originalUrl } = req.body

    if (!originalUrl) {
        return res.status(400).json({ error: 'originalUrl is required' })
    }

    try {
        // Check if this URL was already shortened
        let existing = await Url.findOne({ originalUrl })
        if (existing) {
            return res.json({ shortCode: existing.shortCode, summary: existing.summary })
        }

        // Generate a unique short code
        const shortCode = nanoid(5)

        // Save to DB
        const summary = await summarizeUrl(originalUrl)

        const newUrl = new Url({ originalUrl, shortCode, summary })
        await newUrl.save()

        res.json({ shortCode, shortUrl: `http://localhost:3000/${shortCode}`, summary })
    } catch (err) {
        res.status(500).json({ error: 'Server error' })
    }
})

// GET /analytics/:shortCode — get click data
router.get('/analytics/:shortCode', async (req, res) => {
    const { shortCode } = req.params

    try {
        const url = await Url.findOne({ shortCode })

        if (!url) {
            return res.status(404).json({ error: 'URL not found' })
        }

        res.json({
            originalUrl: url.originalUrl,
            shortCode: url.shortCode,
            totalClicks: url.clicks.length,
            clicks: url.clicks
        })
    } catch (err) {
        res.status(500).json({ error: 'Server error' })
    }
})
// GET /:shortCode — redirect to original URL
router.get('/:shortCode', async (req, res) => {
    const { shortCode } = req.params

    try {
        const url = await Url.findOne({ shortCode })

        if (!url) {
            return res.status(404).json({ error: 'URL not found' })
        }

        // Record the click
        url.clicks.push({
            timestamp: new Date(),
            browser: req.headers['user-agent'],
            country: 'Unknown'
        })
        await url.save()

        // 302 redirect
        res.redirect(302, url.originalUrl)
    } catch (err) {
        res.status(500).json({ error: 'Server error' })
    }
})

module.exports = router