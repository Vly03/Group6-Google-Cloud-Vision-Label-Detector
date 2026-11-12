const express = require('express');
const multer = require('multer');
const vision = require('@google-cloud/vision');
const path = require('path');

const app = express();
const client = new vision.ImageAnnotatorClient();
const port = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));

// Keep the image in memory; there is no need to save it on disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, callback) => {
    if (!['image/jpeg', 'image/png'].includes(file.mimetype)) {
      return callback(new Error('Please upload a JPG or PNG image.'));
    }
    callback(null, true);
  }
});

app.get('/', (req, res) => {
  res.render('index', { error: null });
});

app.post('/analyze', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).render('index', { error: 'Please choose an image first.' });
  }

  try {
    // Send the uploaded image bytes to Google Cloud Vision.
    const [response] = await client.labelDetection({
      image: { content: req.file.buffer }
    });

    if (response.error && response.error.message) {
      throw new Error(response.error.message);
    }

    const labels = (response.labelAnnotations || [])
      .map(label => ({
        name: label.description || 'Unknown',
        confidence: Math.round((label.score || 0) * 1000) / 10
      }))
      .sort((a, b) => b.confidence - a.confidence);

    res.render('results', { labels });
  } catch (error) {
    console.error('Vision labeling failed:', error);
    res.status(500).render('index', {
      error: 'Image analysis failed. Check the server logs and Vision API setup.'
    });
  }
});

// Handle invalid image types and upload-size errors.
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError || error) {
    return res.status(400).render('index', { error: error.message });
  }
  next();
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Vision labeling website running on port ${port}`);
});
