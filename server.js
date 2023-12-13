const express = require('express');
const path = require('path');
const multer = require('multer');
const { QueueServiceClient } = require("@azure/storage-queue");
const fs = require('fs');
const app = express();

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(express.static(path.join(__dirname, 'my-photo-library', 'build')));

app.get('/WEB*', (req, res) => {
    res.sendFile(path.join(__dirname, 'my-photo-library', 'build', 'index.html'));
});

app.get('/getImage', (req, res) => {
    const images = {
        "images": ["https://images.pexels.com/photos/19020394/pexels-photo-19020394/free-photo-of-woman-lying-in-bed-with-laptop.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1",
            "https://images.pexels.com/photos/19102754/pexels-photo-19102754/free-photo-of-table-outside-bakery-in-winter-ambience.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1",
            "https://images.pexels.com/photos/19102754/pexels-photo-19102754/free-photo-of-table-outside-bakery-in-winter-ambience.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1",
            "https://images.pexels.com/photos/19102754/pexels-photo-19102754/free-photo-of-table-outside-bakery-in-winter-ambience.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1",
            "https://images.pexels.com/photos/19102754/pexels-photo-19102754/free-photo-of-table-outside-bakery-in-winter-ambience.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1",
            "https://images.pexels.com/photos/19102754/pexels-photo-19102754/free-photo-of-table-outside-bakery-in-winter-ambience.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1",],
        "totalPages": 10
    }
    res.json(images);
});

const connectionString = 'DefaultEndpointsProtocol=https;AccountName=imagequeue;AccountKey=Lk6oFDUe09G7op84LNGt0FJ27ogcGifctO8IJds3F1OHraCetqBio/BE8LrAMyLMiMtNYHSgjUn6+AStcfPHOA==;EndpointSuffix=core.windows.net';
const queueName = 'imagequeue';
const queueServiceClient = QueueServiceClient.fromConnectionString(connectionString);
const queueClient = queueServiceClient.getQueueClient(queueName);


app.post('/API1', upload.single('file'), async (req, res) => {
    try {
        const imageBuffer = req.file.buffer;
        const encodedImage = imageBuffer.toString('base64');
        await queueClient.sendMessage(encodedImage);
        res.status(200).send('Image uploaded to queue');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error uploading image to queue');
    }
});


app.post('/API2', (req, res) => {

});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});