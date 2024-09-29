const express = require('express');
const cors = require('cors');
const multer = require('multer');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './uploads');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}_${file.originalname}`);
  },
});

const upload = multer({ storage: storage });

mongoose.connect('mongodb+srv://hritika3410:rCC26HuDaY5i0trv@schoolsurvey.hustk.mongodb.net/?retryWrites=true&w=majority&appName=schoolsurvey', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const SchoolSchema = new mongoose.Schema({
  schoolName: String,
  location: String,
  faults: [String],
  comments: String,
  imagePath: [String],
});

const School = mongoose.model('School', SchoolSchema);

app.post('/api/schools', upload.array('images', 10), async (req, res) => {
  const { schoolName, location, faults, comments } = req.body;
  const parsedFaults = JSON.parse(faults);
  const imagePaths = req.files.map((file) => `/uploads/${file.filename}`);
  const newSchool = new School({
    schoolName,
    location,
    faults: parsedFaults,
    comments,
    imagePath: imagePaths,
  });

  try {
    await newSchool.save();
    res.status(200).send({ message: 'Data stored successfully' });
  } catch (error) {
    res.status(500).send({ message: 'Error storing data', error });
  }
});

app.get('/api/schools/filter', async (req, res) => {
  const { schoolName } = req.query;

  try {
    const filteredSchools = await School.find({ schoolName: schoolName });
    if (filteredSchools.length === 0) {
      return res.status(404).send({ message: 'No schools found with the given name' });
    }
    res.status(200).json(filteredSchools);
  } catch (error) {
    res.status(500).send({ message: 'Error fetching data', error });
  }
});

app.get('/api/schools/pdf', async (req, res) => {
  const { schoolName } = req.query;

  try {
    const filteredSchools = await School.find({ schoolName: schoolName });

    if (filteredSchools.length === 0) {
      return res.status(404).send({ message: 'No schools found with the given name' });
    }

    const doc = new PDFDocument();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${schoolName}_report.pdf`);
    doc.pipe(res);
    doc.fontSize(25).text(`Report for ${schoolName}`, { align: 'center' });

    let schoolCounter = 1;

    for (const school of filteredSchools) {
      doc.moveDown()
        .fontSize(15)
        .text(`${schoolCounter}. Location: ${school.location}`);

      if (school.comments && school.comments.trim() !== '') {
        doc.text(`Comments : ${school.comments}`);
      } else {
        doc.text('Comments : No comments');
      }

      const faultDescriptions = [
        'Ease and adjust all windows and doors',
        'Replace damaged seals/gaskets',
        'Replace broken window handles, hinges, and other ironmongery',
        'Replace damaged/broken down double glazed units',
        'Overhaul window operating/locking mechanisms'
      ];

      const selectedFaults = school.faults
        .map((fault, index) => fault === "true" ? faultDescriptions[index] : null)
        .filter(fault => fault !== null);

      if (selectedFaults.length > 0) {
        doc.text('Selected Faults:');
        selectedFaults.forEach(fault => {
          doc.text(`- ${fault}`);
        });
      } else {
        doc.text('No faults selected.');
      }

      if (school.imagePath && school.imagePath.length > 0) {
        doc.text('Images:');
        const imagesPerRow = 4;
        const imageWidth = 100;
        const spacing = 10;
        let currentX = 50;
        let currentY = doc.y;

        for (let i = 0; i < school.imagePath.length; i++) {
          const imagePath = school.imagePath[i];
          const resolvedImagePath = path.join(__dirname, imagePath);
          console.log(`Resolved Image Path: ${resolvedImagePath}`);

          if (fs.existsSync(resolvedImagePath)) {
            doc.image(resolvedImagePath, {
              fit: [imageWidth, imageWidth],
              align: 'center',
              valign: 'center',
              x: currentX,
              y: currentY,
            });

            currentX += imageWidth + spacing;

            if ((i + 1) % imagesPerRow === 0) {
              currentX = 50;
              currentY += imageWidth + spacing;
            }
          } else {
            console.log(`Image not found at path: ${resolvedImagePath}`);
            doc.moveDown().text('Image not available.');
          }
        }

        doc.moveDown(2);
      } else {
        doc.moveDown().text('No image paths provided.');
      }

      doc.moveDown(4);
      schoolCounter++;
    }

    doc.end();
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).send({ message: 'Error generating PDF', error });
  }
});

app.get('/api/schools/names', async (req, res) => {
  try {
    const uniqueSchoolNames = await School.distinct('schoolName');
    res.status(200).json(uniqueSchoolNames);
  } catch (error) {
    res.status(500).send({ message: 'Error fetching school names', error });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
