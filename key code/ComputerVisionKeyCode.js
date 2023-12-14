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