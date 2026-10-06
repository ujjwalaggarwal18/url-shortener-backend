const express = require('express')
const router = express.Router()
const { nanoid } = require('nanoid')
const rateLimit = require('express-rate-limit')
const Url = require('../models/Url')
const { GoogleGenerativeAI } = require('@google/generative-ai')

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

// Limits how often one IP can call /shorten (protects Gemini quota + DB)
const shortenLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15-minute window
    limit: 20,                // 20 requests per IP per window
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, try again later' }
})

// Accepts only real http(s) URLs given as strings
const isValidHttpUrl = (value) => {
    if (typeof value !== 'string' || value.length > 2048) return false
    try {
        const u = new URL(value)
        return u.protocol === 'http:' || u.protocol === 'https:'
    } catch {
        return false
    }
}

const buildShortUrl = (req, shortCode) =>
    `${req.protocol}://${req.get('host')}/${shortCode}`

const summarizeUrl = async (url) => {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
        const prompt = `In 2-3 sentences, describe what this URL is likely about based on its address. Be concise and informative. URL: ${url}`
        const result = await model.generateContent(prompt)
        return result.response.text()
    } catch (err) {
        console.log('Gemini error:', err.message)
        return null
    }
}

// POST /shorten — create a short URL
router.post('/shorten', shortenLimiter, async (req, res) => {
    const { originalUrl } = req.body

    if (!isValidHttpUrl(originalUrl)) {
        return res.status(400).json({ error: 'A valid http(s) URL is required' })
    }

    try {
        // Check if this URL was already shortened
        const existing = await Url.findOne({ originalUrl })
        if (existing) {
            return res.json({
                shortCode: existing.shortCode,
                shortUrl: buildShortUrl(req, existing.shortCode),
                summary: existing.summary
            })
        }

        // Call Gemini once, outside the retry loop
        const summary = await summarizeUrl(originalUrl)

        // Let the unique index on shortCode decide; retry only on duplicate-key errors
        let newUrl
        for (let attempt = 0; attempt < 5; attempt++) {
            try {
                newUrl = await Url.create({
                    originalUrl,
                    shortCode: nanoid(5),
                    summary
                })
                break
            } catch (err) {
                if (err.code !== 11000) throw err
            }
        }

        if (!newUrl) {
            return res.status(500).json({ error: 'Could not generate a unique code' })
        }

        res.json({
            shortCode: newUrl.shortCode,
            shortUrl: buildShortUrl(req, newUrl.shortCode),
            summary: newUrl.summary
        })
    } catch (err) {
        console.log('Shorten error:', err.message)
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
        const url = await Url.findOneAndUpdate(
            { shortCode },
            {
                $push: {
                    clicks: {
                        timestamp: new Date(),
                        browser: req.headers['user-agent'],
                        country: 'Unknown'
                    }
                }
            },
            { new: true }
        )

        if (!url) {
            return res.status(404).json({ error: 'URL not found' })
        }

        res.redirect(302, url.originalUrl)
    } catch (err) {
        console.log('Redirect error:', err.message)
        res.status(500).json({ error: 'Server error' })
    }
})

module.exports = router