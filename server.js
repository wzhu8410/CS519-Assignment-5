const express = require('express');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const imageSize = require('image-size');
const { QueueServiceClient } = require("@azure/storage-queue");
const { ComputerVisionClient } = require('@azure/cognitiveservices-computervision');
const { ApiKeyCredentials } = require('@azure/ms-rest-js');
const fs = require('fs');
const { debug } = require('util');
const { v4: uuidv4 } = require('uuid');
const { MongoClient } = require('mongodb');
const app = express();

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(express.static(path.join(__dirname, 'build')));
app.use(express.json({ limit: '50mb' }));

app.get('/WEB*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

const connectionString = 'DefaultEndpointsProtocol=https;AccountName=imagequeue;AccountKey=Lk6oFDUe09G7op84LNGt0FJ27ogcGifctO8IJds3F1OHraCetqBio/BE8LrAMyLMiMtNYHSgjUn6+AStcfPHOA==;EndpointSuffix=core.windows.net';
const queueName = 'imagequeue';
const queueServiceClient = QueueServiceClient.fromConnectionString(connectionString);
const queueClient = queueServiceClient.getQueueClient(queueName);


app.post('/API1', upload.single('file'), async (req, res) => {
    try {
        const imageBuffer = req.file.buffer;
        const encodedImage = imageBuffer.toString('base64');
        const filename = req.file.originalname;

        const imageJson = {
            filename: filename,
            image: encodedImage
        };

        await queueClient.sendMessage(JSON.stringify(imageJson));
        res.status(200).send('Image uploaded to queue');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error uploading image to queue');
    }
});



const key = 'f290042ac2fc44e4ba5c92bececa276b';
const endpoint = 'https://myphotolibrarycvapi.cognitiveservices.azure.com/';

const computerVisionClient = new ComputerVisionClient(
    new ApiKeyCredentials({ inHeader: { 'Ocp-Apim-Subscription-Key': key } }), endpoint
);

const mongourl = 'mongodb://myphotolibrary-server:q54KY5qyPzI2bGfkbOrM22JeTI4Ue2fZCGGbGcT1mgS2iDNAYZ1mDYjBsxE600OlRE4eWdWgFdaKACDbvNzxPg==@myphotolibrary-server.mongo.cosmos.azure.com:10255/?ssl=true&retrywrites=false&maxIdleTimeMS=120000&appName=@myphotolibrary-server@';

app.post('/API2', async (req, res) => {
    try {
        // get filename
        const filename = req.body.filename
        const base64Image = req.body.image;
        const buffer = Buffer.from(base64Image, 'base64');

        // get image size
        const sizeInBytes = buffer.length;
        const sizeInKilobytes = sizeInBytes / 1024;

        // generate downsized image
        const processedImage = await sharp(buffer)
            .resize(512, 512, {
                fit: sharp.fit.inside,
                withoutEnlargement: true
            })
            .toBuffer();

        downsizedImageBase64 = processedImage.toString('base64');

        const tempFilePath = 'tempimage.jpg';
        fs.writeFileSync(tempFilePath, processedImage);
        imageStream = () => fs.createReadStream(tempFilePath);

        // get decription & objects & dimensions
        const analysis = await computerVisionClient.analyzeImageInStream(
            imageStream,
            { visualFeatures: ['Description', 'Objects'], language: 'en' }
        );

        async function transformAnalysisToSimpleJson(analysis) {
            const textCaptions = analysis.description.captions.map(caption => caption.text);

            const entitiesLists = analysis.objects.map(object => object.object);

            const dimensions = {
                width: analysis.metadata.width,
                height: analysis.metadata.height
            };

            const simplifiedJson = {
                textCaptions,
                entitiesLists,
                dimensions
            };
            return simplifiedJson;
        }

        const simpleJson = transformAnalysisToSimpleJson(analysis)

        // get thumbnail
        function streamToBuffer(stream) {
            return new Promise((resolve, reject) => {
                const chunks = [];
                stream.on('data', (chunk) => chunks.push(chunk));
                stream.on('end', () => resolve(Buffer.concat(chunks)));
                stream.on('error', reject);
            });
        }

        const thumbnailResponse = await computerVisionClient.generateThumbnailInStream(150, 150, imageStream, { smartCropping: true });
        const thumbnailBuffer = await streamToBuffer(thumbnailResponse.readableStreamBody);
        const thumbnailBase64 = thumbnailBuffer.toString('base64');

        // generate original, downsized & thumbnail image's URL
        const originalURL = uuidv4();
        const downsizedURL = uuidv4();
        const thumbnailURL = uuidv4();


        // data processing for insert operation
        const originalJson = {
            fileURL: originalURL,
            base64: base64Image
        }

        const downsizedJson = {
            fileURL: downsizedURL,
            base64: downsizedImageBase64
        }

        const thumbnailJson = {
            fileURL: thumbnailURL,
            base64: thumbnailBase64
        }


        const ImageInfoJson = {
            filename: filename,
            size: sizeInKilobytes,
            dimensions: (await simpleJson).dimensions,
            textCaptions: (await simpleJson).textCaptions,
            entitiesLists: (await simpleJson).entitiesLists,
            originalURL: originalURL,
            downsizedURL: downsizedURL,
            thumbnailURL: thumbnailURL
        }

        // insert data into cosmosDB
        const client = await MongoClient.connect(mongourl, { tls: true });
        console.log('Connected successfully to server');

        const db = client.db('myphotolibrary-database');

        const imageStorageCollection = db.collection('imageStorage');
        await imageStorageCollection.insertOne(originalJson);
        await imageStorageCollection.insertOne(downsizedJson);
        await imageStorageCollection.insertOne(thumbnailJson);

        const imageInfoCollection = db.collection('imageInfo');
        const num = await imageInfoCollection.countDocuments();
        ImageInfoJson["id"] = num + 1;
        await imageInfoCollection.insertOne(ImageInfoJson);


        client.close();

        fs.unlinkSync(tempFilePath);
        res.status(200).send("Image uploaded to CosmosDB");

        
    } catch (error) {
        console.error(error);
        res.status(500).send('Error processing the image');
    }
});

app.get('/getImage', async (req, res) => {
    try {
        const l = parseInt(req.query.l,10);
        const r = parseInt(req.query.r,10);
        console.log(l, r)

        const client = await MongoClient.connect(mongourl, { tls: true });
        console.log('Connected successfully to server');
        const db = client.db('myphotolibrary-database');
        const imageStorageCollection = db.collection('imageStorage');
        const imageInfoCollection = db.collection('imageInfo');

        async function getThumbnailURLs(l, r) {
            try {
                const query = { id: { $gte: l, $lte: r } };
                console.log(query)
                const projection = { _id: 0, thumbnailURL: 1 };
                const documents = await imageInfoCollection.find(query).project(projection).toArray();
                return documents.map(doc => doc.thumbnailURL);
            } catch (err) {
                console.error("Error in getThumbnailURLsInRange:", err);
                throw err; 
            }
        }

        const ThumbnailURLs = await getThumbnailURLs(l, r);

        console.log(ThumbnailURLs);
        
        async function generateBase64Images(fileURLs) {
            try {
                const documents = await imageStorageCollection.find({ fileURL: { $in: fileURLs } }).toArray();

                const base64Images = documents.map(doc => {
                    const base64 = doc.base64;
                    return `data:image/jpeg;base64,${base64}`;
                });

                return base64Images;
            } catch (err) {
                console.error("Error in generateBase64Image:", err);
                throw err; 
            }
        }

        const Base64Images = await generateBase64Images(ThumbnailURLs);
        console.log(Base64Images);

        const totalPages = await imageInfoCollection.countDocuments();
        const images = {
            "images": Base64Images,
            "totalPages": totalPages
        }
        res.json(images);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error processing the image');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
